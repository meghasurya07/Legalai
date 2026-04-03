/**
 * Memory Embedder — Vector embedding pipeline for memories
 *
 * Wraps lib/rag/embeddings.ts for memory-specific use cases.
 * Supports single and batch embedding with retry logic.
 */

import { embedText } from '@/lib/rag/embeddings'
import { supabase } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Generate an embedding for a single memory content string.
 */
export async function embedMemory(content: string): Promise<number[]> {
    return embedText(content)
}

/**
 * Generate embeddings for multiple memory items and return them.
 * Processes in parallel with concurrency limit.
 */
export async function embedMemoryBatch(
    items: { id: string; content: string }[]
): Promise<{ id: string; embedding: number[] }[]> {
    if (items.length === 0) return []

    const CONCURRENCY = 5
    const results: { id: string; embedding: number[] }[] = []

    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch = items.slice(i, i + CONCURRENCY)
        const embeddings = await Promise.allSettled(
            batch.map(async (item) => {
                const embedding = await embedText(item.content)
                return { id: item.id, embedding }
            })
        )

        for (const result of embeddings) {
            if (result.status === 'fulfilled') {
                results.push(result.value)
            }
        }
    }

    return results
}

/**
 * Backfill embeddings for memories that don't have them yet.
 * Called during migration or as a maintenance task.
 */
export async function backfillMemoryEmbeddings(
    limit: number = 50
): Promise<number> {
    const { data: memories, error } = await supabase
        .from('memories')
        .select('id, content')
        .is('embedding', null)
        .eq('is_active', true)
        .limit(limit)

    if (error || !memories || memories.length === 0) return 0

    const embeddings = await embedMemoryBatch(
        memories.map(m => ({ id: m.id, content: m.content }))
    )

    let updated = 0
    for (const { id, embedding } of embeddings) {
        const { error: updateError } = await supabase
            .from('memories')
            .update({ embedding: JSON.stringify(embedding) })
            .eq('id', id)

        if (!updateError) updated++
    }

    logger.info("memory/embedder", `[Memory Embedder] Backfilled ${updated}/${memories.length} embeddings`)
    return updated
}
