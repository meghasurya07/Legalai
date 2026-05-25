/**
 * Graph Visualization API (M16)
 * 
 * Returns the full project knowledge graph for UI rendering.
 * Supports two modes:
 * - Full graph: all entities and relationships
 * - Query-focused: entities relevant to a search query with BFS traversal
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildProjectGraph, retrieveQueryFocusedGraph } from '@/lib/graph'
import { requireAuth } from '@/lib/auth/require-auth'
import { apiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth

        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('project_id')
        const query = searchParams.get('query')
        const entityLimit = parseInt(searchParams.get('entity_limit') || '200')
        const relLimit = parseInt(searchParams.get('relationship_limit') || '500')

        if (!projectId) {
            return apiError('project_id is required', 400)
        }

        // Query-focused mode: return context string + entities
        if (query) {
            const context = await retrieveQueryFocusedGraph(projectId, query, entityLimit)
            const graph = await buildProjectGraph(projectId, { entityLimit, relationshipLimit: relLimit })

            return NextResponse.json({
                mode: 'query_focused',
                query,
                context,
                entities: graph.entities.map(e => ({
                    id: e.id,
                    name: e.name,
                    type: e.entity_type,
                    metadata: e.metadata,
                })),
                relationships: graph.relationships.map(r => ({
                    id: r.id,
                    source: r.source_entity_id,
                    target: r.target_entity_id,
                    type: r.relationship_type,
                    evidence: r.evidence_text?.slice(0, 200),
                })),
                stats: {
                    entityCount: graph.entities.length,
                    relationshipCount: graph.relationships.length,
                },
            })
        }

        // Full graph mode
        const graph = await buildProjectGraph(projectId, { entityLimit, relationshipLimit: relLimit })

        // Group entities by type for the UI
        const entityTypes = new Map<string, number>()
        for (const e of graph.entities) {
            entityTypes.set(e.entity_type, (entityTypes.get(e.entity_type) || 0) + 1)
        }

        return NextResponse.json({
            mode: 'full',
            entities: graph.entities.map(e => ({
                id: e.id,
                name: e.name,
                type: e.entity_type,
                metadata: e.metadata,
            })),
            relationships: graph.relationships.map(r => ({
                id: r.id,
                source: r.source_entity_id,
                target: r.target_entity_id,
                type: r.relationship_type,
                evidence: r.evidence_text?.slice(0, 200),
            })),
            stats: {
                entityCount: graph.entities.length,
                relationshipCount: graph.relationships.length,
                entityTypes: Object.fromEntries(entityTypes),
            },
        })
    } catch (error) {
        logger.error("api/graph", 'Graph visualization API failed', error)
        return apiError('Failed to retrieve graph', 500)
    }
}
