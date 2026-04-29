import { logger } from '@/lib/logger'
/**
 * Knowledge Graph — Entity Manager
 * 
 * Handles creation, deduplication, and retrieval of graph entities.
 */

import { supabase } from '@/lib/supabase/server'
import { GraphEntity, EntityType, EntitySource } from './types'

/**
 * Normalize an entity name for deduplication.
 */
export function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
}

/**
 * Upsert an entity — returns existing entity if normalized name matches.
 */
export async function upsertEntity(params: {
    projectId: string
    name: string
    type: EntityType
    source: EntitySource
    refId?: string
    metadata?: Record<string, unknown>
}): Promise<string> {
    const { projectId, name, type, source, refId, metadata = {} } = params
    const normalized = normalizeName(name)

    if (!normalized) throw new Error('Entity name cannot be empty')

    // Check for existing entity with same normalized name and type
    const { data: existing } = await supabase
        .from('project_entities')
        .select('id')
        .eq('project_id', projectId)
        .eq('entity_type', type)
        .eq('normalized_name', normalized)
        .limit(1)

    if (existing && existing.length > 0) {
        return existing[0].id
    }

    const { data, error } = await supabase
        .from('project_entities')
        .insert({
            project_id: projectId,
            entity_type: type,
            name,
            normalized_name: normalized,
            source,
            ref_id: refId,
            metadata
        })
        .select()
        .single()

    if (error) {
        logger.error('[Graph] Failed to upsert entity:', 'Error occurred', error)
        throw error
    }

    return data.id
}

/**
 * Find entities by type within a project.
 */
export async function findEntities(projectId: string, type?: EntityType, limit: number = 20): Promise<GraphEntity[]> {
    let query = supabase
        .from('project_entities')
        .select('*')
        .eq('project_id', projectId)

    if (type) {
        query = query.eq('entity_type', type)
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        logger.error('[Graph] Failed to find entities:', 'Error occurred', error)
        return []
    }

    return data as GraphEntity[]
}
