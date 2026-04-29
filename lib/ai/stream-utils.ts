import OpenAI from 'openai'
import type { RetrievedChunk } from '@/lib/rag'
import type { ChatImageInput } from '@/lib/ai/chat-file-inputs'
import type { ChatMode } from '@/lib/ai/config'
import type { MemoryRetrievalResult } from '@/lib/memory'
import { logger } from '@/lib/logger'

/**
 * Parameters shared by all streaming strategies.
 */
export interface StreamParams {
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
    usedMemories: MemoryRetrievalResult[]
    streamStartTime: number
}

/**
 * Extended parameters for the Responses API (web search / thinking / deep research).
 */
export interface ResponsesAPIParams extends StreamParams {
    webSearch: boolean
    thinking: boolean
    deepResearch: boolean
    chatMode: ChatMode
}

/**
 * Safe enqueue wrapper that prevents writes after the stream is closed.
 * Returns an object with enqueue, close, and isClosed.
 */
export function makeSafeEnqueue(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
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
            try { controller.close() } catch (err) { logger.error("chat/stream", "Close failed", err) }
            closed = true
        }
    }
}
