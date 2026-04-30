import OpenAI from 'openai'
import { buildDynamicRAGSourcesBlock } from '@/lib/rag'
import { logger } from '@/lib/logger'
import { phaseEvent, extractCitationsFromResponse } from '@/lib/ai/citation-extractor'
import { buildResponsesUserContent } from '@/lib/ai/chat-file-inputs'
import { saveAssistantMessage } from '@/lib/ai/save-message'
import { makeSafeEnqueue, type ResponsesAPIParams } from './stream-utils'

/**
 * Stream a response using the OpenAI Responses API (web search, thinking, deep research).
 */
export async function streamResponsesAPI(params: ResponsesAPIParams) {
    const {
        controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
        webSearch, thinking, deepResearch, ragChunks,
        imageInputs,
        conversationId, projectId, orgId, userId, usedMemories,
        conversationHistory,
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

    // Build Responses API input with conversation history
    const input: OpenAI.Responses.ResponseInput = [
        { role: 'system', content: fullSystemPrompt },
    ]

    // Inject conversation history for multi-turn context
    if (conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
            input.push({
                role: msg.role,
                content: msg.content.slice(0, 2000) // Truncate to manage tokens
            })
        }
    }

    input.push({ role: 'user', content: buildResponsesUserContent(finalUserPrompt, imageInputs) })

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
        logger.error('chat/responses', 'Stream error', streamErr)
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
