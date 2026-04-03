/**
 * Memory Retriever — 3-way parallel hybrid retrieval engine
 *
 * Combines:
 *   1. Vector path — pgvector similarity search
 *   2. Graph path — entity traversal via project_entities + project_relationships
 *   3. Structured path — SQL queries for specific memory types
 *
 * All 3 paths run in parallel with individual timeouts.
 * Results are merged, scored, deduped, and ranked.
 */

import { supabase } from '@/lib/supabase/server'
import { embedText } from '@/lib/rag/embeddings'
import { analyzeQuery } from './query-analyzer'
import { MAX_RETRIEVAL_COUNT } from './types'
import type {
    MemoryRetrievalResult,
    QueryAnalysis,
    MemoryType,
} from './types'

interface RetrievalInput {
    query: string
    projectId: string
    organizationId?: string
    userId?: string
    blockedProjectIds?: string[]
}

interface RetrievalOutput {
    results: MemoryRetrievalResult[]
    analysis: QueryAnalysis
    pathStats: {
        vector: number
        graph: number
        structured: number
    }
}

/**
 * Execute hybrid memory retrieval — the core intelligence function.
 * Returns scored, deduped results from all 3 retrieval paths.
 */
export async function retrieveMemories(input: RetrievalInput): Promise<RetrievalOutput> {
    const { query, projectId, organizationId, userId, blockedProjectIds } = input

    // 1. Analyze query intent
    const analysis = await analyzeQuery(query)

    // 2. Run all 3 paths in parallel with timeout
    const TIMEOUT_MS = 2000

    const [vectorResults, graphResults, structuredResults] = await Promise.allSettled([
        withTimeout(vectorSearch(query, projectId, organizationId, analysis, blockedProjectIds), TIMEOUT_MS),
        withTimeout(graphSearch(query, projectId, analysis), TIMEOUT_MS),
        withTimeout(structuredSearch(projectId, organizationId, userId, analysis), TIMEOUT_MS),
    ])

    // 3. Collect results from successful paths
    const allResults: MemoryRetrievalResult[] = []

    const vectorItems = vectorResults.status === 'fulfilled' ? vectorResults.value : []
    const graphItems = graphResults.status === 'fulfilled' ? graphResults.value : []
    const structuredItems = structuredResults.status === 'fulfilled' ? structuredResults.value : []

    allResults.push(...vectorItems, ...graphItems, ...structuredItems)

    // 4. Deduplicate by memory ID
    const seen = new Set<string>()
    const deduped: MemoryRetrievalResult[] = []
    for (const item of allResults) {
        if (!seen.has(item.id)) {
            seen.add(item.id)
            deduped.push(item)
        }
    }

    // 5. Score and rank
    const scored = deduped.map(item => ({
        ...item,
        relevance_score: computeRelevanceScore(item, analysis),
    }))

    scored.sort((a, b) => {
        // Pinned always first
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return b.relevance_score - a.relevance_score
    })

    // 6. Limit results
    const final = scored.slice(0, MAX_RETRIEVAL_COUNT)

    return {
        results: final,
        analysis,
        pathStats: {
            vector: vectorItems.length,
            graph: graphItems.length,
            structured: structuredItems.length,
        },
    }
}

// ═══════════════════════════════════════════════════
// PATH 1: Vector Similarity Search
// ═══════════════════════════════════════════════════

async function vectorSearch(
    query: string,
    projectId: string,
    organizationId: string | undefined,
    analysis: QueryAnalysis,
    blockedProjectIds?: string[]
): Promise<MemoryRetrievalResult[]> {
    try {
        const queryEmbedding = await embedText(query)

        // Determine search scope
        const isOrgWide = analysis.retrieval_scope !== 'project_only' && organizationId

        const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.65,
            match_count: 15,
            filter_project_id: isOrgWide ? null : projectId,
            filter_org_id: isOrgWide ? organizationId : null,
            filter_types: analysis.memory_types.length > 0 ? analysis.memory_types : null,
        })

        if (error || !data) return []

        // Filter out blocked projects (ethical walls)
        const blocked = new Set(blockedProjectIds || [])

        return data
            .filter((row: Record<string, unknown>) => !blocked.has(row.project_id as string))
            .map((row: Record<string, unknown>) => ({
                id: row.id as string,
                content: row.content as string,
                memory_type: row.memory_type as MemoryType,
                source: row.source as MemoryRetrievalResult['source'],
                confidence: row.confidence as number,
                importance: row.importance as number,
                authority_weight: row.authority_weight as number,
                is_pinned: row.is_pinned as boolean,
                project_id: row.project_id as string | null,
                created_at: row.created_at as string,
                relevance_score: row.similarity as number,
                retrieval_path: 'vector' as const,
                metadata: row.metadata as Record<string, unknown> || {},
            }))
    } catch (err) {
        console.warn('[Memory Retriever] Vector search failed:', err)
        return []
    }
}

// ═══════════════════════════════════════════════════
// PATH 2: Graph Traversal
// ═══════════════════════════════════════════════════

async function graphSearch(
    query: string,
    projectId: string,
    analysis: QueryAnalysis
): Promise<MemoryRetrievalResult[]> {
    try {
        if (analysis.entities.length === 0) return []

        // Find entities matching the query entities
        const results: MemoryRetrievalResult[] = []

        for (const entityName of analysis.entities.slice(0, 5)) {
            const normalized = entityName.toLowerCase().trim()

            // Find matching entities
            const { data: entities } = await supabase
                .from('project_entities')
                .select('id, name, entity_type, metadata')
                .eq('project_id', projectId)
                .ilike('normalized_name', `%${normalized}%`)
                .limit(3)

            if (!entities || entities.length === 0) continue

            // Traverse relationships to find connected memories
            const entityIds = entities.map(e => e.id)

            const { data: relationships } = await supabase
                .from('project_relationships')
                .select('source_entity_id, target_entity_id, relationship_type, evidence_text')
                .eq('project_id', projectId)
                .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`)
                .limit(10)

            if (!relationships) continue

            // Convert graph evidence to memory-like results
            for (const rel of relationships) {
                if (rel.evidence_text) {
                    results.push({
                        id: `graph-${rel.source_entity_id}-${rel.target_entity_id}`,
                        content: rel.evidence_text,
                        memory_type: 'insight',
                        source: 'document',
                        confidence: 0.7,
                        importance: 3,
                        authority_weight: 0.8,
                        is_pinned: false,
                        project_id: projectId,
                        created_at: new Date().toISOString(),
                        relevance_score: 0.65,
                        retrieval_path: 'graph',
                        metadata: {
                            relationship_type: rel.relationship_type,
                            entity_name: entityName,
                        },
                    })
                }
            }
        }

        return results
    } catch (err) {
        console.warn('[Memory Retriever] Graph search failed:', err)
        return []
    }
}

// ═══════════════════════════════════════════════════
// PATH 3: Structured SQL Queries
// ═══════════════════════════════════════════════════

async function structuredSearch(
    projectId: string,
    organizationId: string | undefined,
    userId: string | undefined,
    analysis: QueryAnalysis
): Promise<MemoryRetrievalResult[]> {
    try {
        const results: MemoryRetrievalResult[] = []

        // Always fetch pinned memories for the project
        const { data: pinned } = await supabase
            .from('memories')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_pinned', true)
            .eq('is_active', true)
            .limit(5)

        if (pinned) {
            for (const row of pinned) {
                results.push(toRetrievalResult(row, 'structured', 0.9))
            }
        }

        // Fetch user preferences if intent suggests it
        if (userId && (
            analysis.intent === 'preference_check' ||
            analysis.intent === 'drafting'
        )) {
            const { data: prefs } = await supabase
                .from('memories')
                .select('*')
                .eq('user_id', userId)
                .in('memory_type', ['preference', 'correction'])
                .eq('is_active', true)
                .order('importance', { ascending: false })
                .limit(5)

            if (prefs) {
                for (const row of prefs) {
                    results.push(toRetrievalResult(row, 'structured', 0.75))
                }
            }
        }

        // Fetch high-importance facts for the project
        const { data: facts } = await supabase
            .from('memories')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .gte('importance', 4)
            .order('importance', { ascending: false })
            .order('reinforcement_count', { ascending: false })
            .limit(5)

        if (facts) {
            for (const row of facts) {
                results.push(toRetrievalResult(row, 'structured', 0.7))
            }
        }

        return results
    } catch (err) {
        console.warn('[Memory Retriever] Structured search failed:', err)
        return []
    }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function toRetrievalResult(
    row: Record<string, unknown>,
    path: 'vector' | 'graph' | 'structured',
    baseScore: number
): MemoryRetrievalResult {
    return {
        id: row.id as string,
        content: row.content as string,
        memory_type: row.memory_type as MemoryType,
        source: row.source as MemoryRetrievalResult['source'],
        confidence: row.confidence as number,
        importance: row.importance as number,
        authority_weight: row.authority_weight as number,
        is_pinned: row.is_pinned as boolean,
        project_id: row.project_id as string | null,
        created_at: row.created_at as string,
        relevance_score: baseScore,
        retrieval_path: path,
        metadata: (row.metadata as Record<string, unknown>) || {},
    }
}

function computeRelevanceScore(
    item: MemoryRetrievalResult,
    analysis: QueryAnalysis
): number {
    let score = item.relevance_score

    // Boost by importance (1-5 → 0.6-1.0)
    score *= 0.6 + (item.importance / 5) * 0.4

    // Boost by authority weight
    score *= item.authority_weight

    // Boost by confidence
    score *= item.confidence

    // Type relevance boost
    if (analysis.memory_types.includes(item.memory_type)) {
        score *= 1.15
    }

    // Recency boost (decay over 90 days)
    const ageMs = Date.now() - new Date(item.created_at).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const recencyMultiplier = Math.max(0.5, 1.0 - ageDays / 180)
    if (analysis.temporal_scope === 'recent') {
        score *= recencyMultiplier
    }

    return Math.max(0, Math.min(1, score))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), ms)
        ),
    ])
}
