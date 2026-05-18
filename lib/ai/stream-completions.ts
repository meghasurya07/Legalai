import OpenAI from 'openai'
import { CitationEngine } from '@/lib/ai/citation-engine'
import { getChatConfig } from '@/lib/ai/config'
import { buildChatCompletionUserContent } from '@/lib/ai/chat-file-inputs'
import { saveAssistantMessage } from '@/lib/ai/save-message'
import { makeSafeEnqueue, type StreamParams } from './stream-utils'

/**
 * Stream a response using the standard Chat Completions API.
 */
export async function streamChatCompletions(params: StreamParams) {
    const {
        controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
        ragChunks, imageInputs,
        conversationId, projectId, orgId, userId, usedMemories,
        conversationHistory,
        streamStartTime,
    } = params
    let { sourcesBlock } = params

    const safe = makeSafeEnqueue(controller, encoder)

    // Get centralized config for standard chat mode
    const chatConfig = getChatConfig('standard')

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: fullSystemPrompt }
    ]

    // Inject conversation history for multi-turn context
    if (conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
            messages.push({
                role: msg.role,
                content: msg.content.slice(0, 2000) // Truncate to manage tokens
            })
        }
    }

    messages.push({ role: 'user', content: buildChatCompletionUserContent(finalUserPrompt, imageInputs) })

    const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: chatConfig.temperature,
        max_completion_tokens: chatConfig.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
    })

    let streamedContent = ''
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null

    for await (const chunk of stream) {
        if (safe.isClosed) break

        // Capture usage from the final chunk (sent when stream_options.include_usage is true)
        if (chunk.usage) {
            usage = chunk.usage
        }

        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
            streamedContent += content
            safe.enqueue(`data: ${JSON.stringify({ content })}\n\n`)
        }
    }

    // ─── Citation Engine: build structured citation index ────────────
    const engine = new CitationEngine()
    if (ragChunks.length > 0) {
        engine.registerRAGSources(ragChunks)
    }

    if (engine.hasCitations() && !safe.isClosed) {
        // Strip any AI-generated SOURCES blocks (the AI should not produce these anymore,
        // but handle gracefully for transition period)
        const aiSourcesRegex = /\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi
        streamedContent = streamedContent.replace(aiSourcesRegex, '').trim()

        // Validate that [N] markers map to real sources; remove orphaned markers
        const validation = engine.validateMarkers(streamedContent)
        if (validation.orphanedMarkers.length > 0) {
            streamedContent = validation.cleanedText
        }

        // Improve snippets for RAG entries using the response text context
        for (const entry of engine.getEntries()) {
            if (entry.type === 'rag' && entry.metadata.fileId) {
                const matchingChunk = ragChunks.find(c => c.id === entry.id.replace('rag-', ''))
                if (matchingChunk) {
                    entry.snippet = engine.findBestSnippet(matchingChunk, streamedContent, entry.num)
                }
            }
        }

        // Build structured citation index
        const citationBlock = engine.serialize()
        sourcesBlock = citationBlock

        safe.enqueue(`data: ${JSON.stringify({ content: streamedContent + citationBlock, replace: true })}\n\n`)
    } else if (!safe.isClosed) {
        // No RAG sources — check if AI generated its own SOURCES block (legacy standard chat)
        const aiSourcesMatch = streamedContent.match(/\n*(<!--SOURCES:?\s*[\s\S]*?-->)/i)
        if (aiSourcesMatch) {
            // Keep AI-generated sources for standard chat (no RAG context)
            sourcesBlock = aiSourcesMatch[1]
            streamedContent = streamedContent.replace(/\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi, '').trim()
            safe.enqueue(`data: ${JSON.stringify({ content: streamedContent + '\n\n' + sourcesBlock, replace: true })}\n\n`)
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

    // Log usage with real token counts from the stream
    const tokensIn = usage?.prompt_tokens || 0
    const tokensOut = usage?.completion_tokens || 0
    import('@/lib/logger').then(({ logEvent }) => {
        logEvent('AI_CALL', {
            useCase: 'assistant_chat',
            model,
            tokensIn,
            tokensOut,
            tokensTotal: usage?.total_tokens || (tokensIn + tokensOut),
            latencyMs: Date.now() - streamStartTime,
            streaming: true,
            success: true,
            charCount: streamedContent.length
        }, projectId ?? undefined, undefined, undefined, userId)
    }).catch(() => { })
}
