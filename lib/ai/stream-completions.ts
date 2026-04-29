import OpenAI from 'openai'
import { ensureCitationMarkers, buildDynamicRAGSourcesBlock } from '@/lib/rag'
import { AI_TEMPERATURES } from '@/lib/ai/config'
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
