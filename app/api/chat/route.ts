import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getPrompts } from '@/lib/ai/prompts'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { AI_TEMPERATURES, getChatConfig, type ChatMode } from '@/lib/ai/config'
import { ensureCitationMarkers, type RetrievedChunk, buildDynamicRAGSourcesBlock } from '@/lib/rag'
import { auth0 } from '@/lib/auth/auth0'
import { logger } from '@/lib/logger'
import { phaseEvent, extractCitationsFromResponse } from '@/lib/ai/citation-extractor'
import { buildChatContext } from '@/lib/ai/context-builder'
import { saveAssistantMessage } from '@/lib/ai/save-message'
import {
    buildChatCompletionUserContent,
    buildResponsesUserContent,
    getImageInputsFromFiles,
    prepareFilesForTextContext,
    type ChatImageInput,
} from '@/lib/ai/chat-file-inputs'

export async function POST(request: NextRequest) {
    try {
        let body
        try {
            body = await request.json()
        } catch {
            return apiError('Invalid JSON in request body', 400)
        }
        const { sanitizeText, validateUUID } = await import('@/lib/validation')
        const message = sanitizeText(body.message, 100000)
        const { customization, files, queryMode, webSearch, thinking, deepResearch, confidenceMode } = body
        const attachedFiles = Array.isArray(files) ? files : []
        const effectiveMessage = message || (attachedFiles.length > 0 ? 'Please analyze the attached image(s).' : '')
        const projectId = validateUUID(body.projectId)
        const conversationId = validateUUID(body.conversationId)

        if (!effectiveMessage) {
            return apiError('Message is required', 400)
        }

        // Require authentication
        const session = await auth0.getSession()
        const userId = session?.user?.sub as string | undefined
        if (!userId) {
            return apiError('Authentication required', 401)
        }

        // Rate limit chat messages
        const { checkRateLimit, RATE_LIMIT_CHAT } = await import('@/lib/rate-limit')
        const { allowed } = checkRateLimit(`chat:${userId}`, RATE_LIMIT_CHAT)
        if (!allowed) {
            return apiError('Too many messages. Please slow down.', 429)
        }

        // Rate limit for deep research: 5 per month per user
        if (deepResearch) {
            const { data: userSettings } = await supabase
                .from('user_settings')
                .select('deep_research_count, deep_research_reset_date')
                .eq('user_id', userId)
                .single()

            const now = new Date()
            let count = userSettings?.deep_research_count || 0
            let resetDate = userSettings?.deep_research_reset_date ? new Date(userSettings.deep_research_reset_date) : now

            if (now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
                count = 0
                resetDate = now
            }

            if (count >= 5) {
                return apiError('Deep Research monthly limit reached (5/5). Please try again next month.', 429)
            }

            await supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    deep_research_count: count + 1,
                    deep_research_reset_date: resetDate.toISOString()
                })
        }

        // ─── Build Chat Context (RAG + Memory + Files) ───────────────
        const imageInputs = getImageInputsFromFiles(attachedFiles)
        const ctx = await buildChatContext(effectiveMessage, projectId, userId, prepareFilesForTextContext(attachedFiles))
        const { userContent, ragSourcesBlock } = ctx
        const { ragContext, ragSystemMessage, ragChunks, memoryContextText, memoryAttributionText, usedMemories } = ctx

        // Determine chat mode
        const chatMode: ChatMode = deepResearch ? 'deepResearch' : thinking ? 'thinking' : webSearch ? 'webSearch' : 'standard'
        const { model } = getChatConfig(chatMode)

        // Resolve OpenAI client (BYOK or system key)
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const orgCtx = await getOrgContext()
            orgId = orgCtx?.orgId
        } catch {
            // No org context — use system key
        }

        const { resolveOpenAIClient } = await import('@/lib/byok')
        const client = await resolveOpenAIClient(orgId, { timeout: deepResearch ? 3600 * 1000 : undefined })
        const encoder = new TextEncoder()
        const streamStartTime = Date.now()

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    const sourcesBlock = ragSourcesBlock

                    // Build the system prompt and user prompt
                    const { systemPrompt, userPrompt } = getPrompts('assistant_chat', {
                        message: userContent,
                        customization,
                        queryMode,
                        webSearch,
                        thinking,
                        deepResearch,
                        hasRagContext: !!ragContext
                    })

                    const fullSystemPrompt = [
                        systemPrompt,
                        ragSystemMessage ? ragSystemMessage : '',
                        memoryContextText ? memoryContextText : '',
                        memoryAttributionText ? memoryAttributionText : ''
                    ].filter(Boolean).join('\n\n')

                    // Move RAG context into user prompt for better citation adherence
                    let finalUserPrompt = ragContext
                        ? `REFERENCED DOCUMENT EXCERPTS:\n\n${ragContext}\n\n---\n\nUser question: ${userPrompt}\n\nCRITICAL: You MUST include [1], [2], [3] citation numbers inline after EVERY factual sentence. Example: "The agreement was signed on Feb 11, 2013 [1]."`
                        : userPrompt

                    if (webSearch || deepResearch) {
                        finalUserPrompt += `\n\n[CRITICAL INSTRUCTION: You MUST actively use the web_search tool to gather the most accurate, up-to-date, and comprehensive information before answering. Do NOT rely solely on your internal training data, even if you think you know the answer.]`
                    }

                    if (confidenceMode) {
                        const sourceDesc = (webSearch || deepResearch) ? "the search results provided by the search tool" : "the provided document context"
                        finalUserPrompt += `\n\n[CONFIDENCE MODE ACTIVATED]\nCRITICAL: You MUST actively evaluate the verifyability of your statements based ONLY on ${sourceDesc}.\nFor EVERY factual claim you make, you MUST append a confidence badge directly after the sentence.\nUse one of these exactly: [CONF_HIGH], [CONF_MEDIUM], or [CONF_LOW].\n\n- Use [CONF_HIGH] if the claim is explicitly stated in the context/results.\n- Use [CONF_MEDIUM] if the claim is implied or synthesized from vague parts of the context/results.\n- Use [CONF_LOW] if you cannot find direct support in the context/results (hallucination risk).\n\nIf you are also using [1] citations, put the confidence badge immediately before or after the citation. Example: "The cap is $5M [1] [CONF_HIGH]."`

                        if (!ragContext && !webSearch && !deepResearch) {
                            finalUserPrompt += `\n\nNOTE: You were not provided with any document context or search results for this query. Therefore, ANY factual claims you make about specific documents, people, or entities MUST be marked as [CONF_LOW].`
                        }
                    }

                    // ═══════════════════════════════════════════════
                    // WEB SEARCH / THINKING / DEEP RESEARCH
                    // → Use OpenAI Responses API with native tools
                    // ═══════════════════════════════════════════════
                    if (webSearch || thinking || deepResearch) {
                        await streamResponsesAPI({
                            controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
                            webSearch, thinking, deepResearch, ragChunks, sourcesBlock,
                            imageInputs,
                            conversationId, projectId, orgId, userId, usedMemories,
                            streamStartTime, chatMode,
                        })
                    } else {
                        // ═══════════════════════════════════════════════
                        // STANDARD CHAT — Chat Completions API
                        // ═══════════════════════════════════════════════
                        await streamChatCompletions({
                            controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
                            ragChunks, sourcesBlock,
                            imageInputs,
                            conversationId, projectId, orgId, userId, usedMemories,
                            streamStartTime,
                        })
                    }
                } catch (err) {
                    logger.error('chat/route', 'Stream error', err)
                    try {
                        controller.enqueue(encoder.encode(phaseEvent('error', 'error', 'Something went wrong while processing')))
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                        controller.close()
                    } catch {
                        // Controller already closed (client disconnected)
                    }
                }
            }
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}


// ═══════════════════════════════════════════════════════════════════
// Streaming Helpers
// ═══════════════════════════════════════════════════════════════════

interface StreamParams {
    controller: ReadableStreamDefaultController
    encoder: TextEncoder
    client: OpenAI
    model: string
    fullSystemPrompt: string
    finalUserPrompt: string
    ragChunks: RetrievedChunk[]
    sourcesBlock: string
    imageInputs: ChatImageInput[]
    conversationId: string | null | undefined
    projectId: string | null | undefined
    orgId?: string
    userId: string
    usedMemories: import('@/lib/memory').MemoryRetrievalResult[]
    streamStartTime: number
}

interface ResponsesAPIParams extends StreamParams {
    webSearch: boolean
    thinking: boolean
    deepResearch: boolean
    chatMode: ChatMode
}

function makeSafeEnqueue(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
    let closed = false
    return {
        enqueue(data: string) {
            if (closed) return false
            try {
                controller.enqueue(encoder.encode(data))
                return true
            } catch {
                closed = true
                return false
            }
        },
        get isClosed() { return closed },
        close() {
            if (closed) return
            try { controller.close() } catch (err) { logger.error("chat/route", "Close failed", err) }
            closed = true
        }
    }
}

/**
 * Stream a response using the OpenAI Responses API (web search, thinking, deep research).
 */
async function streamResponsesAPI(params: ResponsesAPIParams) {
    const {
        controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
        webSearch, thinking, deepResearch, ragChunks,
        imageInputs,
        conversationId, projectId, orgId, userId, usedMemories,
        streamStartTime, chatMode,
    } = params
    let { sourcesBlock } = params

    const safe = makeSafeEnqueue(controller, encoder)

    // Single phase event per mode for clean timeline UI
    if (deepResearch) {
        safe.enqueue(phaseEvent('searching_web', 'start', 'Performing deep research across the web'))
    } else if (webSearch) {
        safe.enqueue(phaseEvent('searching_web', 'start', 'Searching the web'))
    } else if (thinking) {
        safe.enqueue(phaseEvent('thinking', 'start', 'Reasoning through the problem'))
    }

    // Build Responses API input
    const input: OpenAI.Responses.ResponseInput = [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: buildResponsesUserContent(finalUserPrompt, imageInputs) }
    ]

    const responsesOptions = {
        model,
        input,
        stream: true as const,
        ...(thinking ? {
            reasoning: { effort: 'medium' as const, summary: 'auto' as const },
        } : {}),
        ...((webSearch || deepResearch) ? {
            tools: [{ type: 'web_search' as const }],
        } : {}),
    } as OpenAI.Responses.ResponseCreateParamsStreaming

    let streamedContent = ''
    let webSearchCount = 0
    let completedResponse: OpenAI.Responses.Response | null = null
    let pendingDelta = ''

    const stream = await client.responses.create(responsesOptions)

    try {
        for await (const event of stream) {
            if (safe.isClosed) break

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const evt = event as any

            // Stream text deltas — clean raw citation markers in real-time
            if (event.type === 'response.output_text.delta') {
                const rawDelta = event.delta || ''
                if (!rawDelta) continue

                pendingDelta += rawDelta

                const openIdx = pendingDelta.lastIndexOf('【')
                if (openIdx !== -1 && !pendingDelta.includes('】', openIdx)) {
                    const safePart = pendingDelta.slice(0, openIdx)
                    if (safePart) {
                        streamedContent += safePart
                        safe.enqueue(`data: ${JSON.stringify({ content: safePart })}\n\n`)
                    }
                    pendingDelta = pendingDelta.slice(openIdx)
                    continue
                }

                const cleaned = pendingDelta.replace(/【[^】]*】/g, '')
                pendingDelta = ''

                if (cleaned) {
                    streamedContent += cleaned
                    safe.enqueue(`data: ${JSON.stringify({ content: cleaned })}\n\n`)
                }
            }

            // Capture reasoning summary deltas
            if (evt.type === 'response.reasoning_summary_text.delta') {
                const delta = evt.delta as string
                if (delta && thinking) {
                    safe.enqueue(phaseEvent('thinking', 'update', delta.trim()))
                }
            }

            // Track web search calls
            if (evt.type === 'response.web_search_call.in_progress') {
                webSearchCount++
                if (webSearchCount === 1) {
                    safe.enqueue(phaseEvent('searching_web', 'start', 'Searching the web'))
                }
            }

            // Capture completed response for citation extraction
            if (event.type === 'response.completed' && event.response) {
                completedResponse = event.response
            }
            if (evt.type === 'response.incomplete' && evt.response) {
                completedResponse = evt.response
            }
        }
    } catch (streamErr) {
        logger.error('chat/route', 'Stream error', streamErr)
        if (!safe.isClosed && !streamedContent) {
            const errMsg = streamErr instanceof Error ? streamErr.message : 'Stream failed'
            safe.enqueue(`data: ${JSON.stringify({ content: `\n\n⚠️ Error: ${errMsg}` })}\n\n`)
        }
    }

    // Send consolidated web search completion
    if (webSearchCount > 0 && !safe.isClosed) {
        safe.enqueue(phaseEvent('searching_web', 'complete', `Searched ${webSearchCount} site${webSearchCount > 1 ? 's' : ''}`))
    }

    // Flush any remaining pending delta
    if (pendingDelta && !safe.isClosed) {
        const cleaned = pendingDelta.replace(/【[^】]*】/g, '')
        if (cleaned) {
            streamedContent += cleaned
            safe.enqueue(`data: ${JSON.stringify({ content: cleaned })}\n\n`)
        }
    }

    // Rebuild sources dynamically based on what the AI actually selected
    if (ragChunks.length > 0 && streamedContent) {
        sourcesBlock = buildDynamicRAGSourcesBlock(ragChunks, streamedContent)
    }

    // For web search / deep research: extract citations and append sources
    if ((webSearch || deepResearch) && completedResponse && !safe.isClosed) {
        const { processedText, sourcesBlock: citationSourcesBlock } = extractCitationsFromResponse(completedResponse, ragChunks.length + 1)

        if (citationSourcesBlock && processedText) {
            const cleanProcessed = processedText.replace(/【[^】]*】/g, '')
            streamedContent = cleanProcessed
            
            let finalSourcesBlock = citationSourcesBlock
            if (sourcesBlock) {
                const cleanExistingSources = sourcesBlock.replace(/\n*-->\s*$/, '')
                const cleanNewSources = citationSourcesBlock.replace(/^\n*<!--SOURCES:\n/, '')
                finalSourcesBlock = `${cleanExistingSources}\n${cleanNewSources}`
            }
            
            sourcesBlock = finalSourcesBlock
            safe.enqueue(`data: ${JSON.stringify({ content: cleanProcessed + finalSourcesBlock, replace: true })}\n\n`)
        } else {
            const cleanedFinal = streamedContent.replace(/【[^】]*】/g, '')
            if (cleanedFinal !== streamedContent) {
                streamedContent = cleanedFinal
                safe.enqueue(`data: ${JSON.stringify({ content: cleanedFinal, replace: true })}\n\n`)
            }
        }
    } else if (sourcesBlock && !safe.isClosed) {
        safe.enqueue(`data: ${JSON.stringify({ content: sourcesBlock })}\n\n`)
    }

    // Save assistant message
    if (conversationId && streamedContent) {
        const savedMsgId = await saveAssistantMessage({ conversationId, streamedContent, sourcesBlock, projectId, orgId, userId, usedMemories })
        // Send the message ID back to the client so it can be stored for later updates
        if (savedMsgId && !safe.isClosed) {
            safe.enqueue(`event: messageId\ndata: ${JSON.stringify({ messageId: savedMsgId })}\n\n`)
        }
    }

    if (!safe.isClosed) {
        safe.enqueue(phaseEvent('complete', 'end'))
        safe.enqueue('data: [DONE]\n\n')
        safe.close()
    }

    // Log usage
    const responsesUsage = completedResponse?.usage as { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined
    import('@/lib/logger').then(({ logEvent }) => {
        logEvent('AI_CALL', {
            useCase: chatMode === 'deepResearch' ? 'deep_research' : chatMode === 'webSearch' ? 'web_search' : 'thinking',
            model,
            tokensIn: responsesUsage?.input_tokens || 0,
            tokensOut: responsesUsage?.output_tokens || 0,
            tokensTotal: responsesUsage?.total_tokens || ((responsesUsage?.input_tokens || 0) + (responsesUsage?.output_tokens || 0)),
            latencyMs: Date.now() - streamStartTime,
            streaming: true,
            success: true
        }, projectId ?? undefined, undefined, undefined, userId)
    }).catch(() => { })
}

/**
 * Stream a response using the standard Chat Completions API.
 */
async function streamChatCompletions(params: StreamParams) {
    const {
        controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
        ragChunks, imageInputs,
        conversationId, projectId, orgId, userId, usedMemories,
        streamStartTime,
    } = params
    let { sourcesBlock } = params

    const safe = makeSafeEnqueue(controller, encoder)

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: fullSystemPrompt }
    ]
    messages.push({ role: 'user', content: buildChatCompletionUserContent(finalUserPrompt, imageInputs) })

    const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: AI_TEMPERATURES.default,
        stream: true
    })

    let streamedContent = ''

    for await (const chunk of stream) {
        if (safe.isClosed) break
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
            streamedContent += content
            safe.enqueue(`data: ${JSON.stringify({ content })}\n\n`)
        }
    }

    // Handle sources for standard mode (RAG sources or AI-generated)
    if (sourcesBlock && !safe.isClosed) {
        const aiSourcesRegex = /\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi
        if (aiSourcesRegex.test(streamedContent)) {
            streamedContent = streamedContent.replace(aiSourcesRegex, '').trim()
        }

        if (ragChunks.length > 0 && !/\[\d+\]/.test(streamedContent)) {
            streamedContent = ensureCitationMarkers(streamedContent, ragChunks)
        }

        if (ragChunks.length > 0) {
            sourcesBlock = buildDynamicRAGSourcesBlock(ragChunks, streamedContent)
        }

        safe.enqueue(`data: ${JSON.stringify({ content: streamedContent + sourcesBlock, replace: true })}\n\n`)
    } else if (!sourcesBlock && !safe.isClosed) {
        const aiSourcesMatch = streamedContent.match(/\n*(<!--SOURCES:?\s*[\s\S]*?-->)/i)
        if (aiSourcesMatch) {
            streamedContent = streamedContent.replace(/\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi, '').trim()
            safe.enqueue(`data: ${JSON.stringify({ content: '\n\n' + aiSourcesMatch[1] })}\n\n`)
        }
    }

    // Save assistant message
    if (conversationId && streamedContent) {
        const savedMsgId = await saveAssistantMessage({ conversationId, streamedContent, sourcesBlock, projectId, orgId, userId, usedMemories })
        if (savedMsgId && !safe.isClosed) {
            safe.enqueue(`event: messageId\ndata: ${JSON.stringify({ messageId: savedMsgId })}\n\n`)
        }
    }

    if (!safe.isClosed) {
        safe.enqueue('data: [DONE]\n\n')
        safe.close()
    }

    // Log usage
    import('@/lib/logger').then(({ logEvent }) => {
        logEvent('AI_CALL', {
            useCase: 'assistant_chat',
            model,
            tokensIn: 0,
            tokensOut: 0,
            tokensTotal: 0,
            latencyMs: Date.now() - streamStartTime,
            streaming: true,
            success: true,
            charCount: streamedContent.length
        }, projectId ?? undefined, undefined, undefined, userId)
    }).catch(() => { })
}
