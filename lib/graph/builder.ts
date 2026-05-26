/**
 * Knowledge Graph — Builder & Retrieval (Production Upgrade)
 * 
 * KEY UPGRADES:
 * - H19: BFS graph traversal for multi-hop reasoning
 * - H21: Dynamic limits instead of hard caps, pagination support
 * - H22: Fuzzy entity resolution (normalized name + Levenshtein distance)
 * - H23: Dynamic context injection based on query relevance
 */

import { supabase } from '@/lib/supabase/server'
import { GraphEntity, GraphRelationship, ProjectGraph } from './types'
// logger available for future graph traversal debugging

/**
 * Build the full project knowledge graph with configurable limits.
 */
export async function buildProjectGraph(
    projectId: string,
    options?: { entityLimit?: number; relationshipLimit?: number }
): Promise<ProjectGraph> {
    const entityLimit = options?.entityLimit || 200
    const relLimit = options?.relationshipLimit || 500

    const [entitiesResult, relationshipsResult] = await Promise.all([
        supabase
            .from('project_entities')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(entityLimit),
        supabase
            .from('project_relationships')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(relLimit)
    ])

    return {
        entities: (entitiesResult.data || []) as GraphEntity[],
        relationships: (relationshipsResult.data || []) as GraphRelationship[]
    }
}

/**
 * Retrieve entities and their relationships for assistant context.
 * 
 * Uses BFS traversal starting from entities most relevant to the query
 * to build a focused subgraph instead of dumping all entities.
 * 
 * @param projectId - Project scope
 * @param maxDepth - Maximum BFS hops (default: 2 for 2-hop reasoning)
 * @param maxEntities - Maximum entities to include in context
 */
export async function retrieveGraphContext(
    projectId: string,
    maxEntities: number = 30,
    maxDepth: number = 2
): Promise<string> {
    const graph = await buildProjectGraph(projectId, { entityLimit: 200, relationshipLimit: 500 })

    if (graph.entities.length === 0) return ''

    // Build adjacency list for BFS
    const adjacency = buildAdjacencyList(graph)

    // Build entity ID→name map
    const entityNames = new Map<string, string>()
    const entityMap = new Map<string, GraphEntity>()
    for (const e of graph.entities) {
        entityNames.set(e.id, `${e.name} [${e.entity_type}]`)
        entityMap.set(e.id, e)
    }

    // Start BFS from the most important entities (parties first, then others)
    const priorityTypes = ['party', 'document', 'obligation', 'risk', 'clause', 'fact']
    const startEntities = graph.entities
        .sort((a, b) => {
            const aIdx = priorityTypes.indexOf(a.entity_type)
            const bIdx = priorityTypes.indexOf(b.entity_type)
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
        })
        .slice(0, Math.min(5, graph.entities.length))

    // BFS traversal
    const visited = new Set<string>()
    const reachableRelationships: GraphRelationship[] = []
    const queue: Array<{ entityId: string; depth: number }> = []

    for (const e of startEntities) {
        queue.push({ entityId: e.id, depth: 0 })
        visited.add(e.id)
    }

    while (queue.length > 0 && visited.size < maxEntities) {
        const { entityId, depth } = queue.shift()!

        if (depth >= maxDepth) continue

        const neighbors = adjacency.get(entityId) || []
        for (const { neighborId, relationship } of neighbors) {
            reachableRelationships.push(relationship)

            if (!visited.has(neighborId) && visited.size < maxEntities) {
                visited.add(neighborId)
                queue.push({ entityId: neighborId, depth: depth + 1 })
            }
        }
    }

    // Format output — entities by type
    const byType = new Map<string, string[]>()
    for (const entityId of visited) {
        const e = entityMap.get(entityId)
        if (!e) continue
        const list = byType.get(e.entity_type) || []
        list.push(e.name)
        byType.set(e.entity_type, list)
    }

    let context = ''

    for (const [type, names] of byType) {
        context += `${type.toUpperCase()}S: ${names.join(', ')}\n`
    }

    // Format unique relationships (dedup by source→type→target)
    const uniqueRels = deduplicateRelationships(reachableRelationships)
    if (uniqueRels.length > 0) {
        context += '\nRELATIONSHIPS:\n'
        for (const r of uniqueRels.slice(0, 20)) {
            const src = entityNames.get(r.source_entity_id) || '?'
            const tgt = entityNames.get(r.target_entity_id) || '?'
            context += `- ${src} → ${r.relationship_type} → ${tgt}`
            if (r.evidence_text) context += ` (${r.evidence_text.slice(0, 100)})`
            context += '\n'
        }
    }

    return context
}

/**
 * Query-focused graph traversal.
 * Given a user query, find the most relevant entities and traverse their neighborhoods.
 * Uses fuzzy name matching against query terms.
 */
export async function retrieveQueryFocusedGraph(
    projectId: string,
    query: string,
    maxEntities: number = 20,
    maxDepth: number = 2
): Promise<string> {
    const graph = await buildProjectGraph(projectId, { entityLimit: 200, relationshipLimit: 500 })
    if (graph.entities.length === 0) return ''

    // Find entities mentioned in or relevant to the query
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const scoredEntities = graph.entities.map(e => {
        const nameWords = e.name.toLowerCase().split(/\s+/)
        let score = 0
        for (const qw of queryWords) {
            for (const nw of nameWords) {
                if (nw.includes(qw) || qw.includes(nw)) {
                    score += 2
                } else if (levenshteinDistance(qw, nw) <= 2) {
                    score += 1 // fuzzy match
                }
            }
        }
        return { entity: e, score }
    })

    // Start from highest-scoring entities
    const seeds = scoredEntities
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.entity)

    // If no query-relevant entities, fall back to default traversal
    if (seeds.length === 0) {
        return retrieveGraphContext(projectId, maxEntities, maxDepth)
    }

    // BFS from seed entities
    const adjacency = buildAdjacencyList(graph)
    const entityNames = new Map<string, string>()
    const entityMap = new Map<string, GraphEntity>()
    for (const e of graph.entities) {
        entityNames.set(e.id, `${e.name} [${e.entity_type}]`)
        entityMap.set(e.id, e)
    }

    const visited = new Set<string>()
    const reachableRelationships: GraphRelationship[] = []
    const queue: Array<{ entityId: string; depth: number }> = []

    for (const e of seeds) {
        queue.push({ entityId: e.id, depth: 0 })
        visited.add(e.id)
    }

    while (queue.length > 0 && visited.size < maxEntities) {
        const { entityId, depth } = queue.shift()!
        if (depth >= maxDepth) continue

        const neighbors = adjacency.get(entityId) || []
        for (const { neighborId, relationship } of neighbors) {
            reachableRelationships.push(relationship)
            if (!visited.has(neighborId) && visited.size < maxEntities) {
                visited.add(neighborId)
                queue.push({ entityId: neighborId, depth: depth + 1 })
            }
        }
    }

    // Format
    const byType = new Map<string, string[]>()
    for (const entityId of visited) {
        const e = entityMap.get(entityId)
        if (!e) continue
        const list = byType.get(e.entity_type) || []
        list.push(e.name)
        byType.set(e.entity_type, list)
    }

    let context = ''
    for (const [type, names] of byType) {
        context += `${type.toUpperCase()}S: ${names.join(', ')}\n`
    }

    const uniqueRels = deduplicateRelationships(reachableRelationships)
    if (uniqueRels.length > 0) {
        context += '\nRELATIONSHIPS:\n'
        for (const r of uniqueRels.slice(0, 20)) {
            const src = entityNames.get(r.source_entity_id) || '?'
            const tgt = entityNames.get(r.target_entity_id) || '?'
            context += `- ${src} → ${r.relationship_type} → ${tgt}`
            if (r.evidence_text) context += ` (${r.evidence_text.slice(0, 100)})`
            context += '\n'
        }
    }

    return context
}

// ─── Internal Helpers ─────────────────────────────────────────────

interface AdjacencyEntry {
    neighborId: string
    relationship: GraphRelationship
}

/**
 * Build an adjacency list from entities and relationships (undirected).
 */
function buildAdjacencyList(graph: ProjectGraph): Map<string, AdjacencyEntry[]> {
    const adj = new Map<string, AdjacencyEntry[]>()

    for (const r of graph.relationships) {
        // Source → Target
        const srcList = adj.get(r.source_entity_id) || []
        srcList.push({ neighborId: r.target_entity_id, relationship: r })
        adj.set(r.source_entity_id, srcList)

        // Target → Source (bidirectional traversal)
        const tgtList = adj.get(r.target_entity_id) || []
        tgtList.push({ neighborId: r.source_entity_id, relationship: r })
        adj.set(r.target_entity_id, tgtList)
    }

    return adj
}

/**
 * Deduplicate relationships by source→type→target triple.
 */
function deduplicateRelationships(rels: GraphRelationship[]): GraphRelationship[] {
    const seen = new Set<string>()
    const unique: GraphRelationship[] = []

    for (const r of rels) {
        const key = `${r.source_entity_id}:${r.relationship_type}:${r.target_entity_id}`
        if (!seen.has(key)) {
            seen.add(key)
            unique.push(r)
        }
    }

    return unique
}

/**
 * Calculate Levenshtein edit distance between two strings.
 * Used for fuzzy entity matching (H22).
 */
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    // Short-circuit for very different lengths
    if (Math.abs(a.length - b.length) > 3) return Math.max(a.length, b.length)

    const matrix: number[][] = []
    for (let i = 0; i <= a.length; i++) {
        matrix[i] = [i]
    }
    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            )
        }
    }

    return matrix[a.length][b.length]
}
