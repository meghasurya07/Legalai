/**
 * RAG Embedding Service
 * 
 * Generates vector embeddings for text chunks using OpenAI's embedding API.
 * 
 * KEY UPGRADES:
 * - Exponential backoff with retry (H6): handles rate limits and transient failures
 * - Configurable retry count and backoff parameters
 * - Batch processing with graceful per-batch error handling
 */

import OpenAI from 'openai'
import { EMBEDDING_CONFIG } from '@/lib/ai/config'
import { logger } from '@/lib/logger'

export interface EmbeddingResult {
    content: string
    embedding: number[]
    tokenCount: number
    chunkIndex: number
    fileName?: string
    pageNumber?: number
    sectionHeading?: string
}

interface ChunkInput {
    content: string
    tokenCount: number
    chunkIndex: number
    fileName?: string
    pageNumber?: number
    sectionHeading?: string
}

const EMBEDDING_MODEL = EMBEDDING_CONFIG.model
const BATCH_SIZE = EMBEDDING_CONFIG.batchSize
const EMBEDDING_DIMENSIONS = EMBEDDING_CONFIG.dimensions

/** Maximum retry attempts for API calls */
const MAX_RETRIES = 3
/** Base delay in ms for exponential backoff */
const BASE_DELAY_MS = 1000

let openaiClient: OpenAI | null = null

function getClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) throw new Error('Wesley requires configuration')
        openaiClient = new OpenAI({ apiKey })
    }
    return openaiClient
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with exponential backoff retry.
 * Retries on rate limit (429), server errors (5xx), and network failures.
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    context: string,
    maxRetries: number = MAX_RETRIES
): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            // Don't retry on non-transient errors (auth, invalid request, etc.)
            const message = lastError.message.toLowerCase()
            const isTransient = (
                message.includes('rate_limit') ||
                message.includes('429') ||
                message.includes('500') ||
                message.includes('502') ||
                message.includes('503') ||
                message.includes('timeout') ||
                message.includes('econnreset') ||
                message.includes('econnrefused') ||
                message.includes('network')
            )

            if (!isTransient || attempt >= maxRetries) {
                throw lastError
            }

            // Exponential backoff: 1s, 2s, 4s (with ±20% jitter)
            const delay = BASE_DELAY_MS * Math.pow(2, attempt)
            const jitter = delay * (0.8 + Math.random() * 0.4)
            
            logger.warn('[RAG Embeddings]', `${context} — attempt ${attempt + 1} failed (${lastError.message}), retrying in ${Math.round(jitter)}ms...`)
            await sleep(jitter)
        }
    }

    throw lastError || new Error(`${context} failed after ${maxRetries} retries`)
}

/**
 * Generate embedding for a single text string.
 * Used for query embedding during retrieval.
 * Includes retry with exponential backoff.
 */
export async function embedText(text: string): Promise<number[]> {
    return withRetry(async () => {
        const client = getClient()

        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text.replace(/\n/g, ' ').trim(),
            dimensions: EMBEDDING_DIMENSIONS,
        })

        return response.data[0].embedding
    }, 'embedText')
}

/**
 * Generate embeddings for multiple chunks in batches.
 * Returns chunks with their computed embeddings.
 * Each batch is retried independently — partial results are returned on failure.
 */
export async function embedChunks(chunks: ChunkInput[]): Promise<EmbeddingResult[]> {
    if (chunks.length === 0) return []

    const results: EmbeddingResult[] = []

    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE)
        const texts = batch.map(c => c.content.replace(/\n/g, ' ').trim())
        const batchNum = Math.floor(i / BATCH_SIZE) + 1

        try {
            const response = await withRetry(async () => {
                const client = getClient()
                return await client.embeddings.create({
                    model: EMBEDDING_MODEL,
                    input: texts,
                    dimensions: EMBEDDING_DIMENSIONS,
                })
            }, `embedChunks batch ${batchNum}`)

            const totalTokens = response.usage?.total_tokens || 0
            logger.info("rag/embeddings", `[RAG Embeddings] Batch ${batchNum}: ${batch.length} chunks, ${totalTokens} tokens used`)

            for (let j = 0; j < response.data.length; j++) {
                results.push({
                    content: batch[j].content,
                    embedding: response.data[j].embedding,
                    tokenCount: batch[j].tokenCount,
                    chunkIndex: batch[j].chunkIndex,
                    fileName: batch[j].fileName,
                    pageNumber: batch[j].pageNumber,
                    sectionHeading: batch[j].sectionHeading,
                })
            }
        } catch (error) {
            logger.error('lib', `[RAG Embeddings] Batch ${batchNum} failed after retries:`, error)
            // Continue with remaining batches — partial results are better than none
        }
    }

    return results
}
