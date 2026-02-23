/**
 * Knowledge Graph — Builder & Retrieval
 * 
 * Provides high-level graph queries for the assistant and workflows.
 */

import { supabase } from '@/lib/supabase/server'
import { GraphEntity, GraphRelationship, ProjectGraph } from './types'

/**
 * Build the full project knowledge graph.
 */
export async function buildProjectGraph(projectId: string): Promise<ProjectGraph> {
    const [entitiesResult, relationshipsResult] = await Promise.all([
        supabase
            .from('project_entities')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('project_relationships')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(200)
    ])

    return {
        entities: (entitiesResult.data || []) as GraphEntity[],
        relationships: (relationshipsResult.data || []) as GraphRelationship[]
    }
}

/**
 * Retrieve entities and their direct relationships for assistant context.
 * Returns a compact text summary suitable for injection into the prompt.
 */
export async function retrieveGraphContext(projectId: string, limit: number = 15): Promise<string> {
    const graph = await buildProjectGraph(projectId)

    if (graph.entities.length === 0) return ''

    // Build entity ID→name map
    const entityNames = new Map<string, string>()
    for (const e of graph.entities) {
        entityNames.set(e.id, `${e.name} [${e.entity_type}]`)
    }

    // Format entities by type
    const byType = new Map<string, string[]>()
    for (const e of graph.entities.slice(0, limit)) {
        const list = byType.get(e.entity_type) || []
        list.push(e.name)
        byType.set(e.entity_type, list)
    }

    let context = ''

    for (const [type, names] of byType) {
        context += `${type.toUpperCase()}S: ${names.join(', ')}\n`
    }

    // Format key relationships
    if (graph.relationships.length > 0) {
        context += '\nRELATIONSHIPS:\n'
        for (const r of graph.relationships.slice(0, 10)) {
            const src = entityNames.get(r.source_entity_id) || '?'
            const tgt = entityNames.get(r.target_entity_id) || '?'
            context += `- ${src} → ${r.relationship_type} → ${tgt}`
            if (r.evidence_text) context += ` (${r.evidence_text.slice(0, 100)})`
            context += '\n'
        }
    }

    return context
}
