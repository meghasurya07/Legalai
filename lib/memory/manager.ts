import { logger } from '@/lib/logger'
/**
 * Memory Manager — CRUD operations for the intelligent memory store
 *
 * Handles: addMemory (with semantic dedup), getMemories, updateMemory,
 * deleteMemory, getMemoryStats, reinforceMemory.
 *
 * All operations target the new `memories` table with pgvector support.
 */

import { supabase } from '@/lib/supabase/server'
import { embedMemory } from './embedder'
import type {
    MemoryItem,
    MemoryType,
    MemorySource,
    MemoryStats,
} from './types'

// ═══════════════════════════════════════════════════
// ADD MEMORY
// ═══════════════════════════════════════════════════

interface AddMemoryParams {
    projectId: string
    organizationId?: string
    userId?: string
    content: string
    type: MemoryType
    source: MemorySource
    sourceId?: string
    importance?: number
    confidence?: number
    authorityWeight?: number
    embedding?: number[]
    sourceContext?: string
    metadata?: Record<string, unknown>
}

/**
 * Add a memory to the store with semantic dedup.
 * Returns 'duplicate' if a semantically similar memory already exists.
 * Returns the memory ID on success, or null on failure.
 */
export async function addMemory(
    params: AddMemoryParams
): Promise<string | 'duplicate' | null> {
    const {
        projectId,
        organizationId,
        userId,
        content,
        type,
        source,
        sourceId,
        importance = 3,
        confidence = 0.8,
        authorityWeight = 0.7,
        embedding,
        sourceContext,
        metadata = {},
    } = params

    try {
        // 1. Semantic dedup — check for existing similar memory
        if (embedding) {
            const { data: similar } = await supabase.rpc('match_memories', {
                query_embedding: JSON.stringify(embedding),
                match_threshold: 0.92, // Very high threshold for dedup
                match_count: 1,
                filter_project_id: projectId,
            })

            if (similar && similar.length > 0) {
                // Reinforce existing memory instead of creating duplicate
                await reinforceMemory(similar[0].id)
                return 'duplicate'
            }
        } else {
            // Fallback: exact content dedup
            const { data: existing } = await supabase
                .from('memories')
                .select('id')
                .eq('project_id', projectId)
                .eq('content', content)
                .eq('is_active', true)
                .limit(1)

            if (existing && existing.length > 0) {
                await reinforceMemory(existing[0].id)
                return 'duplicate'
            }
        }

        // 2. Insert new memory
        const insertData: Record<string, unknown> = {
            project_id: projectId,
            memory_type: type,
            content,
            source,
            source_id: sourceId || null,
            source_context: sourceContext || null,
            importance,
            confidence,
            authority_weight: authorityWeight,
            decay_weight: 1.0,
            reinforcement_count: 0,
            is_pinned: false,
            is_active: true,
            metadata,
        }

        if (organizationId) insertData.organization_id = organizationId
        if (userId) insertData.user_id = userId
        if (embedding) insertData.embedding = JSON.stringify(embedding)

        const { data, error } = await supabase
            .from('memories')
            .insert(insertData)
            .select('id')
            .single()

        if (error) {
            logger.error('[Memory] Insert failed:', error.message)
            return null
        }

        return data.id
    } catch (err) {
        logger.error('[Memory] addMemory error:', 'Error occurred', err)
        return null
    }
}

// ═══════════════════════════════════════════════════
// RETRIEVE MEMORIES
// ═══════════════════════════════════════════════════

interface GetMemoriesParams {
    projectId?: string
    organizationId?: string
    userId?: string
    types?: MemoryType[]
    isActive?: boolean
    isPinned?: boolean
    search?: string
    limit?: number
    offset?: number
}

/**
 * Retrieve memories with filters. Returns structured MemoryItem[].
 */
export async function getMemories(params: GetMemoriesParams): Promise<MemoryItem[]> {
    const {
        projectId,
        organizationId,
        userId,
        types,
        isActive = true,
        isPinned,
        search,
        limit = 50,
        offset = 0,
    } = params

    let query = supabase
        .from('memories')
        .select('*')
        .eq('is_active', isActive)
        .order('is_pinned', { ascending: false })
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (projectId) query = query.eq('project_id', projectId)
    if (organizationId) query = query.eq('organization_id', organizationId)
    if (userId) query = query.eq('user_id', userId)
    if (types && types.length > 0) query = query.in('memory_type', types)
    if (isPinned !== undefined) query = query.eq('is_pinned', isPinned)
    if (search) query = query.ilike('content', `%${search}%`)

    const { data, error } = await query

    if (error) {
        logger.error('[Memory] getMemories error:', error.message)
        return []
    }

    return (data || []) as unknown as MemoryItem[]
}

// ═══════════════════════════════════════════════════
// UPDATE MEMORY
// ═══════════════════════════════════════════════════

interface UpdateMemoryParams {
    id: string
    content?: string
    importance?: number
    is_pinned?: boolean
}

/**
 * Update a memory's content, importance, or pin status.
 * Re-generates embedding if content is changed.
 */
export async function updateMemory(params: UpdateMemoryParams): Promise<boolean> {
    const { id, content, importance, is_pinned } = params

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (content !== undefined) {
        updates.content = content
        // Re-embed on content change
        try {
            const embedding = await embedMemory(content)
            updates.embedding = JSON.stringify(embedding)
        } catch {
            logger.warn('lib', '[Memory] Re-embedding failed on update')
        }
    }

    if (importance !== undefined) updates.importance = Math.max(1, Math.min(5, importance))
    if (is_pinned !== undefined) updates.is_pinned = is_pinned

    const { error } = await supabase
        .from('memories')
        .update(updates)
        .eq('id', id)

    if (error) {
        logger.error('[Memory] updateMemory error:', error.message)
        return false
    }

    return true
}

// ═══════════════════════════════════════════════════
// DELETE MEMORY (soft)
// ═══════════════════════════════════════════════════

/**
 * Soft-delete a memory by setting is_active = false.
 */
export async function deleteMemory(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('memories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        logger.error('[Memory] deleteMemory error:', error.message)
        return false
    }

    return true
}

// ═══════════════════════════════════════════════════
// REINFORCE MEMORY
// ═══════════════════════════════════════════════════

/**
 * Reinforce a memory when it's retrieved and used.
 * Increments reinforcement_count, resets decay_weight to 1.0,
 * and updates last_accessed_at.
 */
export async function reinforceMemory(memoryId: string): Promise<void> {
    try {
        // Fetch current reinforcement count
        const { data } = await supabase
            .from('memories')
            .select('reinforcement_count')
            .eq('id', memoryId)
            .single()

        const currentCount = data?.reinforcement_count ?? 0

        await supabase
            .from('memories')
            .update({
                reinforcement_count: currentCount + 1,
                decay_weight: 1.0,
                last_accessed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', memoryId)
    } catch (err) {
        // Non-critical — log and continue
        logger.warn('[Memory] reinforceMemory warning:', 'Error occurred', err)
    }
}

// ═══════════════════════════════════════════════════
// MEMORY STATS
// ═══════════════════════════════════════════════════

/**
 * Get memory health statistics for a project.
 */
export async function getMemoryStats(projectId: string): Promise<MemoryStats> {
    const defaultStats: MemoryStats = {
        total: 0,
        active: 0,
        stale: 0,
        pinned: 0,
        by_type: {} as Record<MemoryType, number>,
        by_source: {} as Record<MemorySource, number>,
    }

    try {
        // Total + active
        const { count: total } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)

        const { count: active } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('is_active', true)

        const { count: stale } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('is_active', true)
            .lt('decay_weight', 0.2)
            .eq('reinforcement_count', 0)

        const { count: pinned } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('is_pinned', true)
            .eq('is_active', true)

        // By type
        const { data: typeData } = await supabase
            .from('memories')
            .select('memory_type')
            .eq('project_id', projectId)
            .eq('is_active', true)

        const byType: Record<string, number> = {}
        for (const row of typeData || []) {
            byType[row.memory_type] = (byType[row.memory_type] || 0) + 1
        }

        // By source
        const { data: sourceData } = await supabase
            .from('memories')
            .select('source')
            .eq('project_id', projectId)
            .eq('is_active', true)

        const bySource: Record<string, number> = {}
        for (const row of sourceData || []) {
            bySource[row.source] = (bySource[row.source] || 0) + 1
        }

        return {
            total: total || 0,
            active: active || 0,
            stale: stale || 0,
            pinned: pinned || 0,
            by_type: byType as Record<MemoryType, number>,
            by_source: bySource as Record<MemorySource, number>,
        }
    } catch (err) {
        logger.error('[Memory] getMemoryStats error:', 'Error occurred', err)
        return defaultStats
    }
}

// ═══════════════════════════════════════════════════
// LOG ACCESS
// ═══════════════════════════════════════════════════

/**
 * Log that a memory was accessed during retrieval.
 */
export async function logMemoryAccess(params: {
    memoryId: string
    conversationId?: string
    userId?: string
    retrievalScore: number
    wasCited?: boolean
}): Promise<void> {
    try {
        await supabase.from('memory_access_log').insert({
            memory_id: params.memoryId,
            conversation_id: params.conversationId || null,
            user_id: params.userId || null,
            retrieval_score: params.retrievalScore,
            was_cited: params.wasCited || false,
        })
    } catch {
        // Non-critical — fire and forget
    }
}
