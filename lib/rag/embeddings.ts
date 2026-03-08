/**
 * RAG Embedding Service
 * 
 * Generates vector embeddings for text chunks using OpenAI's text-embedding-3-small model.
 * Supports batching for efficient API usage.
 */

import OpenAI from 'openai'
import { EMBEDDING_CONFIG } from '@/lib/ai/config'

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
 * Generate embedding for a single text string.
 * Used for query embedding during retrieval.
 */
export async function embedText(text: string): Promise<number[]> {
    const client = getClient()

    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.replace(/\n/g, ' ').trim(),
        dimensions: EMBEDDING_DIMENSIONS,
    })

    return response.data[0].embedding
}

/**
 * Generate embeddings for multiple chunks in batches.
 * Returns chunks with their computed embeddings.
 */
export async function embedChunks(chunks: ChunkInput[]): Promise<EmbeddingResult[]> {
    if (chunks.length === 0) return []

    const client = getClient()
    const results: EmbeddingResult[] = []

    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE)
        const texts = batch.map(c => c.content.replace(/\n/g, ' ').trim())

        try {
            const response = await client.embeddings.create({
                model: EMBEDDING_MODEL,
                input: texts,
                dimensions: EMBEDDING_DIMENSIONS,
            })

            const totalTokens = response.usage?.total_tokens || 0
            console.log(`[RAG Embeddings] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} chunks, ${totalTokens} tokens used`)

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
            console.error(`[RAG Embeddings] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error)
            // Continue with remaining batches — partial results are better than none
        }
    }

    return results
}
