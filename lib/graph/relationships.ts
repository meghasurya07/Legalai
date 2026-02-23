/**
 * Knowledge Graph — Relationship Manager
 * 
 * Handles creation and retrieval of entity relationships.
 */

import { supabase } from '@/lib/supabase/server'
import { GraphRelationship, RelationshipType } from './types'

/**
 * Add a relationship between two entities.
 * Deduplicates: won't add if same source→target→type exists.
 */
export async function addRelationship(params: {
    projectId: string
    sourceEntityId: string
    targetEntityId: string
    type: RelationshipType
    evidenceText?: string
    refId?: string
}): Promise<string> {
    const { projectId, sourceEntityId, targetEntityId, type, evidenceText, refId } = params

    // Dedup check
    const { data: existing } = await supabase
        .from('project_relationships')
        .select('id')
        .eq('project_id', projectId)
        .eq('source_entity_id', sourceEntityId)
        .eq('target_entity_id', targetEntityId)
        .eq('relationship_type', type)
        .limit(1)

    if (existing && existing.length > 0) {
        return existing[0].id
    }

    const { data, error } = await supabase
        .from('project_relationships')
        .insert({
            project_id: projectId,
            source_entity_id: sourceEntityId,
            target_entity_id: targetEntityId,
            relationship_type: type,
            evidence_text: evidenceText,
            ref_id: refId
        })
        .select()
        .single()

    if (error) {
        console.error('[Graph] Failed to add relationship:', error)
        throw error
    }

    return data.id
}

/**
 * Find relationships for an entity (as source or target).
 */
export async function findRelationships(projectId: string, entityId: string): Promise<GraphRelationship[]> {
    const { data, error } = await supabase
        .from('project_relationships')
        .select('*')
        .eq('project_id', projectId)
        .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error('[Graph] Failed to find relationships:', error)
        return []
    }

    return data as GraphRelationship[]
}
