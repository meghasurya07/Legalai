import { logger } from '@/lib/logger'
/**
 * Knowledge Graph — Entity Manager
 * 
 * Handles creation, deduplication, and retrieval of graph entities.
 * 
 * M17: Existing entities now get their metadata updated on re-encounter
 *      instead of silently returning stale IDs.
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
 * M17: Updates metadata on existing entities instead of discarding new info.
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
        .select('id, metadata')
        .eq('project_id', projectId)
        .eq('entity_type', type)
        .eq('normalized_name', normalized)
        .limit(1)

    if (existing && existing.length > 0) {
        // M17: Update metadata on existing entity instead of returning stale data
        if (metadata && Object.keys(metadata).length > 0) {
            const existingMeta = (existing[0].metadata || {}) as Record<string, unknown>
            await supabase
                .from('project_entities')
                .update({
                    metadata: { ...existingMeta, ...metadata },
                })
                .eq('id', existing[0].id)
        }
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

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
    const m = a.length
    const n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
        }
    }
    return dp[m][n]
}

/**
 * M13: Cross-document entity resolution.
 *
 * Finds and merges duplicate entities across a project by comparing
 * normalized names within each entity type using Levenshtein distance.
 *
 * Merge strategy: keep the entity with more relationships, re-point
 * all relationships from the duplicate to the kept entity, then delete
 * the duplicate.
 *
 * @returns The number of entities merged.
 */
export async function resolveEntitiesAcrossProject(projectId: string): Promise<number> {
    logger.info('graph/entities', `[M13] Starting cross-document entity resolution for project ${projectId}`)

    // 1. Fetch all entities for the project (no limit)
    const { data: allEntities, error: fetchError } = await supabase
        .from('project_entities')
        .select('*')
        .eq('project_id', projectId)

    if (fetchError || !allEntities) {
        logger.error('graph/entities', '[M13] Failed to fetch entities:', fetchError)
        return 0
    }

    // 2. Group entities by type
    const grouped = new Map<string, GraphEntity[]>()
    for (const entity of allEntities as GraphEntity[]) {
        const group = grouped.get(entity.entity_type) || []
        group.push(entity)
        grouped.set(entity.entity_type, group)
    }

    let mergedCount = 0

    // 3. Within each type group, find similar names
    for (const [entityType, entities] of grouped) {
        if (entities.length < 2) continue

        const merged = new Set<string>() // Track IDs already merged away

        for (let i = 0; i < entities.length; i++) {
            if (merged.has(entities[i].id)) continue

            for (let j = i + 1; j < entities.length; j++) {
                if (merged.has(entities[j].id)) continue

                const nameA = normalizeName(entities[i].name)
                const nameB = normalizeName(entities[j].name)

                // Skip if names are identical (already handled by upsertEntity)
                // Check Levenshtein distance: merge if distance <= 2 and names are short,
                // or distance / max-length ratio is small enough
                const distance = levenshtein(nameA, nameB)
                const maxLen = Math.max(nameA.length, nameB.length)
                const isSimilar = maxLen > 0 && (
                    (nameA === nameB) ||
                    (distance <= 2 && maxLen >= 4) ||
                    (maxLen >= 6 && distance / maxLen <= 0.25)
                )

                if (!isSimilar) continue

                logger.info('graph/entities', `[M13] Found similar ${entityType} entities: "${entities[i].name}" ≈ "${entities[j].name}" (dist=${distance})`)

                // 4. Determine which to keep: count relationships for each
                const [relCountA, relCountB] = await Promise.all([
                    supabase
                        .from('entity_relationships')
                        .select('*', { count: 'exact', head: true })
                        .or(`source_entity_id.eq.${entities[i].id},target_entity_id.eq.${entities[i].id}`),
                    supabase
                        .from('entity_relationships')
                        .select('*', { count: 'exact', head: true })
                        .or(`source_entity_id.eq.${entities[j].id},target_entity_id.eq.${entities[j].id}`)
                ])

                const countA = relCountA.count ?? 0
                const countB = relCountB.count ?? 0

                const keepEntity = countA >= countB ? entities[i] : entities[j]
                const dupEntity = countA >= countB ? entities[j] : entities[i]

                // 5. Re-point relationships from duplicate to kept entity
                await supabase
                    .from('entity_relationships')
                    .update({ source_entity_id: keepEntity.id })
                    .eq('source_entity_id', dupEntity.id)

                await supabase
                    .from('entity_relationships')
                    .update({ target_entity_id: keepEntity.id })
                    .eq('target_entity_id', dupEntity.id)

                // 6. Delete the duplicate entity
                const { error: deleteError } = await supabase
                    .from('project_entities')
                    .delete()
                    .eq('id', dupEntity.id)

                if (deleteError) {
                    logger.error('graph/entities', `[M13] Failed to delete duplicate entity ${dupEntity.id}:`, deleteError)
                    continue
                }

                merged.add(dupEntity.id)
                mergedCount++
                logger.info('graph/entities', `[M13] Merged "${dupEntity.name}" into "${keepEntity.name}"`)
            }
        }
    }

    logger.info('graph/entities', `[M13] Entity resolution complete: ${mergedCount} entities merged`)
    return mergedCount
}

