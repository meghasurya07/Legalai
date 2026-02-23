/**
 * Memory Extractor
 * 
 * Uses AI to extract persistent insights from text.
 */

import { callAI } from '@/lib/ai/client'
import { ExtractedMemory, MemorySource } from './types'
import { addMemory } from './manager'
import { parseAIJSON } from '@/lib/api-utils'

/**
 * Extract and persist memories from a block of text.
 * Runs fire-and-forget logic if called asynchronously.
 */
export async function extractAndPersistMemories(params: {
    projectId: string
    text: string
    source: MemorySource
    sourceId?: string
}) {
    const { projectId, text, source, sourceId } = params

    if (!text || text.length < 50) return // Skip tiny snippets

    try {
        console.log(`[Memory] Extracting insights from ${source} (${sourceId || 'no-id'})`)

        const { result } = await callAI('memory_extraction', { text }, {
            jsonMode: true
        })

        const parsed = parseAIJSON(result, 'memories') as ExtractedMemory[]

        if (!Array.isArray(parsed)) return

        // Persist each valid memory
        const results = await Promise.allSettled(
            parsed.map(item =>
                addMemory({
                    projectId,
                    content: item.content,
                    type: item.type,
                    source,
                    sourceId,
                    importance: item.importance,
                    metadata: { reasoning: item.reasoning }
                })
            )
        )

        const count = results.filter(r => r.status === 'fulfilled').length
        console.log(`[Memory] Successfully extracted and saved ${count} items.`)

    } catch (error) {
        console.error('[Memory] Extraction failed:', error)
    }
}
