import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getPrompts } from '@/lib/ai/prompts'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { AI_TEMPERATURES, getChatConfig, type ChatMode } from '@/lib/ai/config'
import { retrieveRelevantChunks, buildRAGContext, buildRAGSourcesBlock, ensureCitationMarkers, RAG_GROUNDING_INSTRUCTION, type RetrievedChunk, buildDynamicRAGSourcesBlock } from '@/lib/rag'
import { retrieveMemories, assembleMemoryContext, buildMemoryAttribution, logMemoryAccess, reinforceMemory } from '@/lib/memory'
import type { MemoryRetrievalResult } from '@/lib/memory'
import { auth0 } from '@/lib/auth0'
import { logger } from '@/lib/logger'

// Helper to emit SSE phase events
function phaseEvent(phase: string, status: string, detail?: string, meta?: Record<string, unknown>) {
    return `event: phase\ndata: ${JSON.stringify({ phase, status, detail, ...meta })}\n\n`
}

interface AttachedFile {
    name: string
    content?: string
    [key: string]: unknown
}

/**
 * Extract url_citation annotations from a completed Responses API response.
 * Returns processedText (with [N] markers replacing OpenAI citation markers)
 * and a <!--SOURCES: block with [N] title | url | snippet.
 */
function extractCitationsFromResponse(response: OpenAI.Responses.Response, startNum: number = 1): { processedText: string; sourcesBlock: string } {
    const urlToNum = new Map<string, number>()
    const citations: { num: number; title: string; url: string; snippet: string }[] = []
    let num = startNum

    interface AnnotationInfo { startIndex: number; endIndex: number; url: string; title: string }
    const allAnnotations: AnnotationInfo[] = []
    let outputText = ''

    for (const item of response.output) {
        if (item.type === 'message' && item.content) {
            for (const block of item.content) {
                if (block.type === 'output_text') {
                    outputText = block.text || ''
                    if (block.annotations) {
                        for (const ann of block.annotations) {
                            if (ann.type === 'url_citation') {
                                allAnnotations.push({
                                    startIndex: ann.start_index,
                                    endIndex: ann.end_index,
                                    url: ann.url,
                                    title: ann.title || ann.url
                                })
                                if (!urlToNum.has(ann.url)) {
                                    const snippetStart = Math.max(0, ann.start_index - 150)
                                    const contextBefore = outputText.slice(snippetStart, ann.start_index).trim()
                                    const sentenceBreak = contextBefore.search(/[.!?]\s+[A-Z]/)
                                    const snippet = sentenceBreak !== -1
                                        ? contextBefore.slice(sentenceBreak + 2).trim()
                                        : contextBefore

                                    urlToNum.set(ann.url, num)
                                    citations.push({
                                        num,
                                        title: ann.title || ann.url,
                                        url: ann.url,
                                        snippet: snippet.replace(/\n/g, ' ').slice(0, 120)
                                    })
                                    num++
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (citations.length === 0 || !outputText) {
        return { processedText: outputText, sourcesBlock: '' }
    }

    // Replace OpenAI's inline citation text with [N] markers (process from end to preserve indices)
    allAnnotations.sort((a, b) => b.startIndex - a.startIndex)
    let processedText = outputText
    for (const ann of allAnnotations) {
        const citNum = urlToNum.get(ann.url)!
        processedText = processedText.slice(0, ann.startIndex) + ` [${citNum}]` + processedText.slice(ann.endIndex)
    }

    const lines = citations.map(c => `[${c.num}] ${c.title} | ${c.url} | ${c.snippet}`)
    const sourcesBlock = `\n\n<!--SOURCES:\n${lines.join('\n')}\n-->`

    return { processedText, sourcesBlock }
}

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
        const projectId = validateUUID(body.projectId)
        const conversationId = validateUUID(body.conversationId)

        if (!message) {
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
            if (!userId) {
                return apiError('Authentication required for Deep Research', 401)
            }

            const { data: userSettings } = await supabase
                .from('user_settings')
                .select('deep_research_count, deep_research_reset_date')
                .eq('user_id', userId)
                .single()

            const now = new Date()
            let count = userSettings?.deep_research_count || 0
            let resetDate = userSettings?.deep_research_reset_date ? new Date(userSettings.deep_research_reset_date) : now

            // If 30 days have passed, reset our rolling window
            if (now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
                count = 0
                resetDate = now
            }

            if (count >= 5) {
                return apiError('Deep Research monthly limit reached (5/5). Please try again next month.', 429)
            }

            // Increment usage limit immediately before streaming starts
            await supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    deep_research_count: count + 1,
                    deep_research_reset_date: resetDate.toISOString()
                })
        }

        let userContent = message || ''
        let ragContext = ''
        let ragSystemMessage = ''
        let ragSourcesBlock = ''
        let ragChunks: RetrievedChunk[] = []
        let memoryContextText = ''
        let memoryAttributionText = ''
        let usedMemories: MemoryRetrievalResult[] = []

        // 1. RAG Context Injection from Project Documents
        if (projectId) {
            try {
                const retrieval = await retrieveRelevantChunks(projectId, userContent)
                if (retrieval.chunks.length > 0) {
                    ragContext = buildRAGContext(retrieval.chunks)
                    ragSystemMessage = RAG_GROUNDING_INSTRUCTION
                    ragSourcesBlock = buildRAGSourcesBlock(retrieval.chunks)
                    ragChunks = retrieval.chunks
                } else {
                    // Fallback: if no chunks exist (e.g. migration not run yet), use legacy approach
                    const { data: projectFiles } = await supabase
                        .from('files')
                        .select('name, extracted_text')
                        .eq('project_id', projectId)
                        .not('extracted_text', 'is', null)

                    if (projectFiles && projectFiles.length > 0) {
                        userContent += `\n\n--- PROJECT CONTEXT (${projectFiles.length} files) ---\n`
                        projectFiles.forEach(f => {
                            const text = f.extracted_text?.slice(0, 20000) || ''
                            userContent += `\nFILE: ${f.name}\nCONTENT:\n${text}\n----------------\n`
                        })
                        userContent += `\n[INSTRUCTION: Use the above PROJECT CONTEXT to answer the user's query. Cite specific files if relevant.]`
                    }
                }
            } catch (ragError) {
                logger.error('chat/route', 'RAG retrieval error, falling back to legacy', ragError)
                const { data: projectFiles } = await supabase
                    .from('files')
                    .select('name, extracted_text')
                    .eq('project_id', projectId)
                    .not('extracted_text', 'is', null)

                if (projectFiles && projectFiles.length > 0) {
                    userContent += `\n\n--- PROJECT CONTEXT (${projectFiles.length} files) ---\n`
                    projectFiles.forEach(f => {
                        const text = f.extracted_text?.slice(0, 20000) || ''
                        userContent += `\nFILE: ${f.name}\nCONTENT:\n${text}\n----------------\n`
                    })
                    userContent += `\n[INSTRUCTION: Use the above PROJECT CONTEXT to answer the user's query. Cite specific files if relevant.]`
                }
            }
        }

        // 2. Memory Intelligence Retrieval (parallel, non-blocking)
        if (projectId) {
            try {
                const memoryResult = await retrieveMemories({
                    query: message || '',
                    projectId,
                    organizationId: undefined, // orgId resolved later — project-scoped retrieval is sufficient here
                    userId,
                    blockedProjectIds: [],
                })

                if (memoryResult.results.length > 0) {
                    const memContext = assembleMemoryContext(
                        memoryResult.results.filter(m => m.retrieval_path !== 'structured' || m.memory_type !== 'preference'),
                        [],  // Firm patterns — Phase 5
                        memoryResult.results.filter(m => m.memory_type === 'preference')
                    )
                    memoryContextText = memContext.formatted_text
                    memoryAttributionText = buildMemoryAttribution()
                    usedMemories = memoryResult.results
                    logger.info("chat/route", `[Memory] Retrieved ${memoryResult.results.length} memories (V:${memoryResult.pathStats.vector} G:${memoryResult.pathStats.graph} S:${memoryResult.pathStats.structured})`)
                }
            } catch (memError) {
                logger.warn('chat/route', 'Memory retrieval failed (non-blocking)', memError)
            }
        }

        if (files && files.length > 0) {
            const fileNames = files.map((f: AttachedFile) => typeof f === 'string' ? f : f.name).join(', ')
            userContent += `\n\n[User uploaded files in this message: ${fileNames}]`

            const pseudoChunks: RetrievedChunk[] = []
            files.forEach((f: AttachedFile, index: number) => {
                if (typeof f === 'object' && f.content && typeof f.content === 'string') {
                    const rawContent = f.content.slice(0, 100000)
                    const words = rawContent.split(/\s+/)
                    let currentChunk = ''
                    let chunkIndex = 0

                    const fileId = f.id ? String(f.id) : `upload-${index}`

                    for (const w of words) {
                        if (currentChunk.length + w.length > 800 && currentChunk.length > 0) {
                            pseudoChunks.push({
                                id: `${fileId}-${chunkIndex}`,
                                fileId: fileId,
                                fileName: f.name,
                                fileUrl: `https://upload.local/file/${encodeURIComponent(f.name)}`,
                                content: currentChunk.trim(),
                                tokenCount: Math.ceil(currentChunk.length / 4),
                                chunkIndex: chunkIndex++,
                                similarity: 1.0,
                                pageNumber: null,
                                sectionHeading: null,
                            })
                            currentChunk = w
                        } else {
                            currentChunk += (currentChunk ? ' ' : '') + w
                        }
                    }
                    if (currentChunk.trim()) {
                        pseudoChunks.push({
                            id: `${fileId}-${chunkIndex}`,
                            fileId: fileId,
                            fileName: f.name,
                            fileUrl: `https://upload.local/file/${encodeURIComponent(f.name)}`,
                            content: currentChunk.trim(),
                            tokenCount: Math.ceil(currentChunk.length / 4),
                            chunkIndex: chunkIndex,
                            similarity: 1.0,
                            pageNumber: null,
                            sectionHeading: null,
                        })
                    }
                }
            })

            if (pseudoChunks.length > 0) {
                ragChunks = [...ragChunks, ...pseudoChunks]
                ragContext = buildRAGContext(ragChunks)
                ragSystemMessage = RAG_GROUNDING_INSTRUCTION
                ragSourcesBlock = buildRAGSourcesBlock(ragChunks)
            }

            if (!message) {
                userContent += '\nPlease analyze these files.'
            }
        }

        // Determine chat mode
        const chatMode: ChatMode = deepResearch ? 'deepResearch' : thinking ? 'thinking' : webSearch ? 'webSearch' : 'standard'
        const { model } = getChatConfig(chatMode)

        // Resolve OpenAI client (BYOK or system key)
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
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
                    let sourcesBlock = ragSourcesBlock

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
                            // Without context, everything is hallucinated / guessed
                            finalUserPrompt += `\n\nNOTE: You were not provided with any document context or search results for this query. Therefore, ANY factual claims you make about specific documents, people, or entities MUST be marked as [CONF_LOW].`
                        }
                    }

                    // ═══════════════════════════════════════════════
                    // WEB SEARCH / THINKING / DEEP RESEARCH
                    // → Use OpenAI Responses API with native tools
                    // ═══════════════════════════════════════════════
                    if (webSearch || thinking || deepResearch) {
                        // Single phase event per mode for clean timeline UI
                        if (deepResearch) {
                            controller.enqueue(encoder.encode(phaseEvent('searching_web', 'start', 'Performing deep research across the web')))
                        } else if (webSearch) {
                            controller.enqueue(encoder.encode(phaseEvent('searching_web', 'start', 'Searching the web')))
                        } else if (thinking) {
                            controller.enqueue(encoder.encode(phaseEvent('thinking', 'start', 'Reasoning through the problem')))
                        }

                        // Build Responses API input
                        const input: OpenAI.Responses.ResponseInput = [
                            { role: 'system', content: fullSystemPrompt },
                            { role: 'user', content: finalUserPrompt }
                        ]

                        // Build Responses API options per mode (official OpenAI docs)
                        const responsesOptions = {
                            model,
                            input,
                            stream: true as const,
                            // Thinking: reasoning only, no tools
                            ...(thinking ? {
                                reasoning: { effort: 'medium' as const, summary: 'auto' as const },
                            } : {}),
                            // Web Search & Deep Research: web_search_preview tool
                            ...((webSearch || deepResearch) ? {
                                tools: [{ type: 'web_search' as const }],
                            } : {}),
                        } as OpenAI.Responses.ResponseCreateParamsStreaming

                        // Stream text immediately for ALL modes (no buffering)
                        let streamedContent = ''
                        let controllerClosed = false
                        let webSearchCount = 0

                        const safeEnqueue = (data: Uint8Array) => {
                            if (controllerClosed) return false
                            try {
                                controller.enqueue(data)
                                return true
                            } catch {
                                controllerClosed = true
                                return false
                            }
                        }

                        const stream = await client.responses.create(responsesOptions)
                        let completedResponse: OpenAI.Responses.Response | null = null

                        // Partial buffer for cleaning mid-token citation markers
                        let pendingDelta = ''

                        try {
                            for await (const event of stream) {
                                if (controllerClosed) break

                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const evt = event as any

                                // Stream text deltas — clean raw citation markers in real-time
                                if (event.type === 'response.output_text.delta') {
                                    const rawDelta = event.delta || ''
                                    if (!rawDelta) continue

                                    // Combine with any pending partial marker
                                    pendingDelta += rawDelta

                                    // Check if we're in the middle of a 【...】 marker
                                    const openIdx = pendingDelta.lastIndexOf('【')
                                    if (openIdx !== -1 && !pendingDelta.includes('】', openIdx)) {
                                        const safe = pendingDelta.slice(0, openIdx)
                                        if (safe) {
                                            streamedContent += safe
                                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: safe })}\n\n`))
                                        }
                                        pendingDelta = pendingDelta.slice(openIdx)
                                        continue
                                    }

                                    // Clean any complete 【...】 markers
                                    const cleaned = pendingDelta.replace(/【[^】]*】/g, '')
                                    pendingDelta = ''

                                    if (cleaned) {
                                        streamedContent += cleaned
                                        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: cleaned })}\n\n`))
                                    }
                                }

                                // Capture reasoning summary deltas → send as activity entries
                                if (evt.type === 'response.reasoning_summary_text.delta') {
                                    const delta = evt.delta as string
                                    if (delta && thinking) {
                                        safeEnqueue(encoder.encode(phaseEvent('thinking', 'update', delta.trim())))
                                    }
                                }

                                // Track web search calls — consolidate into a single count
                                if (evt.type === 'response.web_search_call.in_progress') {
                                    webSearchCount++
                                    if (webSearchCount === 1) {
                                        // Only send one "searching" event
                                        safeEnqueue(encoder.encode(phaseEvent('searching_web', 'start', 'Searching the web')))
                                    }
                                }

                                // Capture completed response for citation extraction
                                if (event.type === 'response.completed' && event.response) {
                                    completedResponse = event.response
                                }

                                // Also capture incomplete responses — they still have citations
                                if (evt.type === 'response.incomplete' && evt.response) {
                                    completedResponse = evt.response
                                }
                            }
                        } catch (streamErr) {
                            logger.error('chat/route', 'Stream error', streamErr)
                            if (!controllerClosed && !streamedContent) {
                                const errMsg = streamErr instanceof Error ? streamErr.message : 'Stream failed'
                                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: `\n\n⚠️ Error: ${errMsg}` })}\n\n`))
                            }
                        }

                        // Send consolidated web search completion
                        if (webSearchCount > 0 && !controllerClosed) {
                            safeEnqueue(encoder.encode(phaseEvent('searching_web', 'complete', `Searched ${webSearchCount} site${webSearchCount > 1 ? 's' : ''}`)))
                        }

                        // Flush any remaining pending delta
                        if (pendingDelta && !controllerClosed) {
                            const cleaned = pendingDelta.replace(/【[^】]*】/g, '')
                            if (cleaned) {
                                streamedContent += cleaned
                                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: cleaned })}\n\n`))
                            }
                        }

                        // Rebuild sources dynamically based on what the AI actually selected
                        if (ragChunks.length > 0 && streamedContent) {
                            sourcesBlock = buildDynamicRAGSourcesBlock(ragChunks, streamedContent)
                        }

                        // For web search / deep research: extract citations and append sources
                        if ((webSearch || deepResearch) && completedResponse && !controllerClosed) {
                            const { processedText, sourcesBlock: citationSourcesBlock } = extractCitationsFromResponse(completedResponse, ragChunks.length + 1)

                            if (citationSourcesBlock && processedText) {
                                // We have proper citations — send a replace with [N] markers + sources
                                const cleanProcessed = processedText.replace(/【[^】]*】/g, '')
                                streamedContent = cleanProcessed
                                
                                let finalSourcesBlock = citationSourcesBlock
                                if (sourcesBlock) {
                                    const cleanExistingSources = sourcesBlock.replace(/\n*-->\s*$/, '')
                                    const cleanNewSources = citationSourcesBlock.replace(/^\n*<!--SOURCES:\n/, '')
                                    finalSourcesBlock = `${cleanExistingSources}\n${cleanNewSources}`
                                }
                                
                                sourcesBlock = finalSourcesBlock
                                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: cleanProcessed + finalSourcesBlock, replace: true })}\n\n`))
                            } else {
                                // No citation annotations — just clean native 【...】 markers but KEEP any [N] markers the AI wrote
                                const cleanedFinal = streamedContent.replace(/【[^】]*】/g, '')
                                if (cleanedFinal !== streamedContent) {
                                    streamedContent = cleanedFinal
                                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: cleanedFinal, replace: true })}\n\n`))
                                }
                            }
                        } else if (sourcesBlock && !controllerClosed) {
                            // RAG sources for non-search modes
                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: sourcesBlock })}\n\n`))
                        }

                        // Save assistant message
                        if (conversationId && streamedContent) {
                            try {
                                const finalContent = sourcesBlock
                                    ? `${streamedContent.trim()}\n\n${sourcesBlock}`
                                    : streamedContent

                                const { error: saveError } = await supabase
                                    .from('messages')
                                    .insert({
                                        conversation_id: conversationId,
                                        role: 'assistant',
                                        content: finalContent
                                    })

                                if (saveError) {
                                    logger.error('chat/route', 'Failed to save assistant message', saveError)
                                } else if (projectId && streamedContent) {
                                    import('@/lib/jobs').then(j => {
                                        j.enqueueJob('MEMORY_EXTRACTION', {
                                            projectId,
                                            organizationId: orgId,
                                            userId,
                                            text: streamedContent,
                                            source: 'chat',
                                            sourceId: conversationId
                                        }, projectId)

                                        // Silent argument extraction (Phase 4)
                                        j.enqueueJob('ARGUMENT_EXTRACTION', {
                                            projectId,
                                            organizationId: orgId,
                                            text: streamedContent,
                                            conversationId
                                        }, projectId)
                                    }).catch(e => logger.error('chat/route', 'Memory job enqueue failed', e))

                                    // Log memory usage for learning loop
                                    if (usedMemories.length > 0) {
                                        Promise.allSettled(
                                            usedMemories.map(m =>
                                                Promise.all([
                                                    logMemoryAccess({
                                                        memoryId: m.id,
                                                        conversationId,
                                                        userId,
                                                        retrievalScore: m.relevance_score,
                                                        wasCited: true,
                                                    }),
                                                    reinforceMemory(m.id),
                                                ])
                                            )
                                        ).catch(() => {})
                                    }
                                }
                            } catch (e) {
                                logger.error('chat/route', 'Error saving assistant message', e)
                            }
                        }
                        

                        if (!controllerClosed) {
                            safeEnqueue(encoder.encode(phaseEvent('complete', 'end')))
                            safeEnqueue(encoder.encode('data: [DONE]\n\n'))
                            try { controller.close() } catch (err) { logger.error("chat/route", "Operation failed", err) }
                        }

                        // Log streaming AI call for usage tracking
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
                            }, projectId, undefined, undefined, userId)
                        }).catch(() => { })

                    } else {
                        // ═══════════════════════════════════════════════
                        // STANDARD CHAT — Chat Completions API
                        // ═══════════════════════════════════════════════


                        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                            { role: 'system', content: fullSystemPrompt }
                        ]

                        messages.push({ role: 'user', content: finalUserPrompt })

                        const stream = await client.chat.completions.create({
                            model,
                            messages,
                            temperature: AI_TEMPERATURES.default,
                            stream: true
                        })

                        let streamedContent = ''
                        let controllerClosed = false

                        const safeEnqueue = (data: Uint8Array) => {
                            if (controllerClosed) return false
                            try {
                                controller.enqueue(data)
                                return true
                            } catch {
                                controllerClosed = true
                                return false
                            }
                        }

                        for await (const chunk of stream) {
                            if (controllerClosed) break
                            const content = chunk.choices[0]?.delta?.content || ''
                            if (content) {
                                streamedContent += content
                                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                            }
                        }

                        // Handle sources for standard mode (RAG sources or AI-generated)
                        if (sourcesBlock && !controllerClosed) {
                            const aiSourcesRegex = /\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi
                            if (aiSourcesRegex.test(streamedContent)) {
                                streamedContent = streamedContent.replace(aiSourcesRegex, '').trim()
                            }

                            // Post-process: inject citation markers if AI didn't generate them FIRST
                            if (ragChunks.length > 0 && !/\[\d+\]/.test(streamedContent)) {
                                streamedContent = ensureCitationMarkers(streamedContent, ragChunks)
                            }

                            if (ragChunks.length > 0) {
                                // Now we can build dynamic sources block, because streamedContent has citations
                                sourcesBlock = buildDynamicRAGSourcesBlock(ragChunks, streamedContent)
                            }

                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: streamedContent + sourcesBlock, replace: true })}\n\n`))
                        } else if (!sourcesBlock && !controllerClosed) {
                            const aiSourcesMatch = streamedContent.match(/\n*(<!--SOURCES:?\s*[\s\S]*?-->)/i)
                            if (aiSourcesMatch) {
                                const extractedSources = aiSourcesMatch[1]
                                streamedContent = streamedContent.replace(/\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi, '').trim()
                                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n' + extractedSources })}\n\n`))
                            }
                        }

                        // Save assistant message
                        if (conversationId && streamedContent) {
                            try {
                                const finalContent = sourcesBlock
                                    ? `${streamedContent.replace(/\n*<!--SOURCES:\n[\s\S]*?-->/g, '').trim()}\n\n${sourcesBlock}`
                                    : streamedContent

                                const { error: saveError } = await supabase
                                    .from('messages')
                                    .insert({
                                        conversation_id: conversationId,
                                        role: 'assistant',
                                        content: finalContent
                                    })

                                if (saveError) {
                                    logger.error('chat/route', 'Failed to save assistant message', saveError)
                                } else if (projectId && streamedContent) {
                                    import('@/lib/jobs').then(j => {
                                        j.enqueueJob('MEMORY_EXTRACTION', {
                                            projectId,
                                            organizationId: orgId,
                                            userId,
                                            text: streamedContent,
                                            source: 'chat',
                                            sourceId: conversationId
                                        }, projectId)
                                    }).catch(e => logger.error('chat/route', 'Memory job enqueue failed', e))

                                    // Log memory usage for learning loop
                                    if (usedMemories.length > 0) {
                                        Promise.allSettled(
                                            usedMemories.map(m =>
                                                Promise.all([
                                                    logMemoryAccess({
                                                        memoryId: m.id,
                                                        conversationId,
                                                        userId,
                                                        retrievalScore: m.relevance_score,
                                                        wasCited: true,
                                                    }),
                                                    reinforceMemory(m.id),
                                                ])
                                            )
                                        ).catch(() => {})
                                    }
                                }
                            } catch (e) {
                                logger.error('chat/route', 'Error saving assistant message', e)
                            }
                        }

                        if (!controllerClosed) {

                            safeEnqueue(encoder.encode('data: [DONE]\n\n'))
                            try { controller.close() } catch (err) { logger.error("chat/route", "Operation failed", err) }
                        }

                        // Log streaming AI call for usage tracking
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
                            }, projectId, undefined, undefined, userId)
                        }).catch(() => { })
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
