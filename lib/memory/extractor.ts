/**
 * Memory Extractor — Multi-type extraction with confidence scoring
 *
 * Extracts memories from legal text/dialogue, applies confidence threshold,
 * generates embeddings, and persists valid items asynchronously.
 *
 * Zero impact on chat latency — designed for fire-and-forget execution.
 */

import { callAI } from '@/lib/ai/client'
import { parseAIJSON } from '@/lib/api-utils'
import { addMemory } from './manager'
import { embedMemory } from './embedder'
import {
    type ExtractionInput,
    type ExtractionResult,
    type ExtractedMemory,
    type MemoryType,
    CONFIDENCE_THRESHOLD,
    AUTHORITY_WEIGHTS,
} from './types'
import { logger } from '@/lib/logger'

/** Valid memory types for validation */
const VALID_MEMORY_TYPES: MemoryType[] = [
    'fact', 'decision', 'risk', 'obligation', 'insight',
    'preference', 'argument', 'outcome', 'procedure',
    'pattern', 'correction',
]

/**
 * Extract and persist memories from a block of text.
 * Runs as a fire-and-forget job — never blocks chat response.
 */
export async function extractAndPersistMemories(
    params: ExtractionInput
): Promise<ExtractionResult> {
    const {
        projectId,
        organizationId,
        userId,
        text,
        source,
        sourceId,
    } = params

    const result: ExtractionResult = {
        extracted: [],
        persisted: 0,
        rejected: 0,
        duplicates: 0,
    }

    // Skip content too short for meaningful extraction
    if (!text || text.length < 100) return result

    try {
        logger.info("memory/extractor", `[Memory] Extracting from ${source} (${text.length} chars)`)

        // 1. AI extraction with confidence scoring
        const { result: aiResult } = await callAI('memory_extraction', { text }, {
            jsonMode: true,
        })

        const parsed = parseAIJSON(aiResult, 'memories') as ExtractedMemory[]
        if (!Array.isArray(parsed) || parsed.length === 0) return result

        result.extracted = parsed

        // 2. Validate and filter
        const validItems = parsed.filter(item => {
            // Type validation
            if (!VALID_MEMORY_TYPES.includes(item.type)) {
                logger.warn("memory/extractor", `Invalid type "${item.type}" — skipping`)
                return false
            }

            // Content validation
            if (!item.content || item.content.length < 10) return false

            // Confidence threshold enforcement
            const confidence = typeof item.confidence === 'number'
                ? Math.max(0, Math.min(1, item.confidence))
                : 0.7  // Default if AI doesn't provide confidence

            if (confidence < CONFIDENCE_THRESHOLD) {
                result.rejected++
                return false
            }

            // Normalize confidence on the item
            item.confidence = confidence
            return true
        })

        // Clamp importance values
        for (const item of validItems) {
            item.importance = Math.max(1, Math.min(5, Math.round(item.importance || 3)))
        }

        logger.info("memory/extractor", `[Memory] Extracted ${parsed.length}, valid ${validItems.length}, rejected ${result.rejected}`)

        // 3. Persist each valid memory with embedding
        const persistResults = await Promise.allSettled(
            validItems.map(async (item) => {
                // Generate embedding (batch would be faster but simpler per-item for robustness)
                let embedding: number[] | undefined
                try {
                    embedding = await embedMemory(item.content)
                } catch {
                    // Embedding failure is non-fatal — memory persists without vector
                    logger.warn("memory/extractor", `Embedding failed for: ${item.content.slice(0, 40)}...`)
                }

                return addMemory({
                    projectId,
                    organizationId,
                    userId,
                    content: item.content,
                    type: item.type,
                    source,
                    sourceId,
                    importance: item.importance,
                    confidence: item.confidence,
                    authorityWeight: AUTHORITY_WEIGHTS[source],
                    embedding,
                    sourceContext: item.source_context,
                    metadata: { reasoning: item.reasoning },
                })
            })
        )

        for (const r of persistResults) {
            if (r.status === 'fulfilled') {
                if (r.value === 'duplicate') {
                    result.duplicates++
                } else {
                    result.persisted++
                }
            }
        }

        logger.info("memory/extractor", 
            `[Memory] Persisted ${result.persisted}, duplicates ${result.duplicates}, ` +
            `rejected ${result.rejected}`
        )

    } catch (error) {
        logger.error("memory/extractor", "Extraction failed", error)
    }

    return result
}
