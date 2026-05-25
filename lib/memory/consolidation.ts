/**
 * Memory Consolidation — H11
 * 
 * Periodically merges clusters of related memories into consolidated summaries.
 * This prevents memory bloat and creates higher-quality, denser memories.
 * 
 * How it works:
 * 1. Find clusters of related memories (same type, vector similarity > 0.8)
 * 2. For clusters of 3+, call AI to merge into a single consolidated memory
 * 3. Archive originals (is_active=false) with metadata pointing to the consolidated version
 * 4. Create the new consolidated memory with boosted importance
 */

import { supabase } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/client'
import { parseAIJSON } from '@/lib/api-utils'
import { embedMemory } from './embedder'
import { logger } from '@/lib/logger'
import type { UseCase } from '@/lib/ai/prompts'

interface ConsolidationResult {
    clustersFound: number
    memoriesConsolidated: number
    newMemoriesCreated: number
}

/**
 * Consolidate related memories within a project.
 * 
 * @param projectId - The project to consolidate memories for
 * @param options - Configuration options
 * @returns Statistics about what was consolidated
 */
export async function consolidateMemories(
    projectId: string,
    options?: { 
        minClusterSize?: number
        similarityThreshold?: number
        maxClusters?: number
    }
): Promise<ConsolidationResult> {
    const minClusterSize = options?.minClusterSize || 3
    const maxClusters = options?.maxClusters || 10
    const result: ConsolidationResult = {
        clustersFound: 0,
        memoriesConsolidated: 0,
        newMemoriesCreated: 0,
    }

    try {
        // 1. Get all active memories for this project
        const { data: memories, error } = await supabase
            .from('memories')
            .select('id, content, memory_type, importance, source, embedding, metadata, reinforcement_count')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(200)

        if (error || !memories || memories.length < minClusterSize) {
            return result
        }

        // 2. Group by type first (only consolidate within same type)
        const byType = new Map<string, typeof memories>()
        for (const m of memories) {
            const list = byType.get(m.memory_type) || []
            list.push(m)
            byType.set(m.memory_type, list)
        }

        // 3. For each type with enough memories, find clusters
        let clustersProcessed = 0
        for (const [memoryType, typeMemories] of byType) {
            if (typeMemories.length < minClusterSize) continue
            if (clustersProcessed >= maxClusters) break

            // Find clusters using pairwise similarity via the embedding
            const clusters = findClusters(typeMemories, minClusterSize)
            
            for (const cluster of clusters) {
                if (clustersProcessed >= maxClusters) break
                result.clustersFound++

                try {
                    // 4. Call AI to consolidate the cluster
                    const clusterContents = cluster.map(m => m.content).join('\n---\n')
                    const { result: aiResult } = await callAI('session_summary' as UseCase, {
                        text: clusterContents,
                    }, {
                        jsonMode: true,
                        maxTokens: 500,
                        temperature: 0.1,
                        systemOverride: `You are a legal memory consolidation system. Given multiple related memory entries of type "${memoryType}", create a single consolidated memory that:
1. Captures ALL important information from the originals
2. Removes redundancy
3. Is more comprehensive than any individual entry
4. Preserves specific details (dates, names, amounts, clauses)

Respond in JSON: { "consolidated": "the merged memory text", "summary": "brief one-line summary" }`,
                        userOverride: clusterContents,
                    })

                    const parsed = parseAIJSON(aiResult, undefined)
                    if (!parsed?.consolidated) continue

                    // 5. Create embedding for consolidated memory
                    const embedding = await embedMemory(parsed.consolidated)

                    // Boost importance: use max importance from cluster + 1 (capped at 5)
                    const maxImportance = Math.max(...cluster.map(m => m.importance || 3))
                    const boostedImportance = Math.min(maxImportance + 1, 5)

                    // 6. Insert consolidated memory
                    const { data: newMemory, error: insertError } = await supabase
                        .from('memories')
                        .insert({
                            project_id: projectId,
                            memory_type: memoryType,
                            content: parsed.consolidated,
                            source: 'system',
                            importance: boostedImportance,
                            confidence: 0.9,
                            authority_weight: 0.8,
                            decay_weight: 1.0,
                            reinforcement_count: cluster.reduce((sum, m) => sum + (m.reinforcement_count || 0), 0),
                            is_pinned: false,
                            is_active: true,
                            embedding: JSON.stringify(embedding),
                            metadata: {
                                consolidated_from: cluster.map(m => m.id),
                                consolidated_at: new Date().toISOString(),
                                original_count: cluster.length,
                            },
                        })
                        .select('id')
                        .single()

                    if (insertError || !newMemory) continue

                    // 7. Archive original memories
                    for (const original of cluster) {
                        const existingMeta = (original.metadata || {}) as Record<string, unknown>
                        await supabase
                            .from('memories')
                            .update({
                                is_active: false,
                                metadata: {
                                    ...existingMeta,
                                    consolidated_into: newMemory.id,
                                    consolidated_at: new Date().toISOString(),
                                },
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', original.id)
                    }

                    result.memoriesConsolidated += cluster.length
                    result.newMemoriesCreated++
                    clustersProcessed++

                    logger.info("memory/consolidation", 
                        `[Memory H11] Consolidated ${cluster.length} ${memoryType} memories into ${newMemory.id}`
                    )
                } catch (err) {
                    logger.error("memory/consolidation", '[Memory H11] Cluster consolidation failed', err)
                }
            }
        }

        return result
    } catch (err) {
        logger.error("memory/consolidation", '[Memory H11] Consolidation failed', err)
        return result
    }
}

/**
 * Simple content-overlap-based clustering.
 * Groups memories by content similarity using word overlap (Jaccard).
 * Uses a greedy approach: pick a seed, find all memories with > 40% word overlap.
 */
function findClusters(
    memories: Array<{ id: string; content: string; importance: number; source: string; reinforcement_count: number; metadata: unknown }>,
    minSize: number
): Array<typeof memories> {
    const used = new Set<string>()
    const clusters: Array<typeof memories> = []

    for (const seed of memories) {
        if (used.has(seed.id)) continue

        const cluster = [seed]
        used.add(seed.id)

        const seedWords = new Set(
            seed.content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3)
        )

        for (const candidate of memories) {
            if (used.has(candidate.id)) continue

            const candidateWords = new Set(
                candidate.content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3)
            )

            // Jaccard similarity
            const intersection = [...seedWords].filter(w => candidateWords.has(w)).length
            const union = new Set([...seedWords, ...candidateWords]).size
            const similarity = union > 0 ? intersection / union : 0

            if (similarity > 0.4) {
                cluster.push(candidate)
                used.add(candidate.id)
            }
        }

        if (cluster.length >= minSize) {
            clusters.push(cluster)
        } else {
            // Un-use if cluster is too small
            for (const m of cluster) {
                used.delete(m.id)
            }
        }
    }

    return clusters
}
