import { logger } from '@/lib/logger'
/**
 * Learning Loop — Decay, Reinforcement & Feedback Engine
 *
 * Implements the self-improvement cycle:
 *   1. Decay: memories lose weight when unused (daily cron)
 *   2. Reinforcement: memories gain weight when retrieved and used
 *   3. Feedback: user ratings (thumbs up/down) affect memory confidence
 *   4. Stale detection: flags memories for review/archival
 *
 * This is the engine that makes Wesley smarter over time.
 */

import { supabase } from '@/lib/supabase/server'
import { DECAY_RATE, STALE_THRESHOLD } from './types'

// ═══════════════════════════════════════════════════
// DECAY ENGINE
// ═══════════════════════════════════════════════════

/**
 * Apply daily decay to all unaccessed, unpinned memories.
 * Pinned memories are exempt. Active memories only.
 *
 * decay_weight *= DECAY_RATE (0.995) for each day since last access.
 * A memory untouched for 90 days: 0.995^90 ≈ 0.64
 * A memory untouched for 365 days: 0.995^365 ≈ 0.16 (stale)
 *
 * Should be called once per day via scheduled job.
 */
export async function applyMemoryDecay(organizationId?: string): Promise<{
    decayed: number
    newlyStale: number
}> {
    // Use raw SQL for efficient bulk update
    let query = `
        UPDATE memories
        SET decay_weight = decay_weight * ${DECAY_RATE},
            updated_at = NOW()
        WHERE is_active = true
          AND is_pinned = false
          AND decay_weight > 0.01
          AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '1 day')
    `

    if (organizationId) {
        query += ` AND organization_id = '${organizationId}'`
    }

    const { data, error } = await supabase.rpc('exec_sql', { query_text: query })

    if (error) {
        // Fallback: do row-by-row if RPC doesn't exist
        logger.warn('[Learning Loop] Bulk decay failed, using row-by-row:', 'Error occurred', error.message)
        return applyDecayRowByRow(organizationId)
    }

    // Count newly stale memories
    const staleResult = await countNewlyStaleMemories(organizationId)

    return {
        decayed: typeof data === 'number' ? data : 0,
        newlyStale: staleResult,
    }
}

/**
 * Fallback: apply decay row-by-row when RPC is not available.
 */
async function applyDecayRowByRow(organizationId?: string): Promise<{
    decayed: number
    newlyStale: number
}> {
    let query = supabase
        .from('memories')
        .select('id, decay_weight')
        .eq('is_active', true)
        .eq('is_pinned', false)
        .gt('decay_weight', 0.01)
        .limit(1000)

    if (organizationId) {
        query = query.eq('organization_id', organizationId)
    }

    const { data: memories } = await query

    if (!memories || memories.length === 0) {
        return { decayed: 0, newlyStale: 0 }
    }

    let decayed = 0
    let newlyStale = 0

    for (const mem of memories) {
        const newWeight = (mem.decay_weight as number) * DECAY_RATE
        const wasAboveThreshold = (mem.decay_weight as number) >= STALE_THRESHOLD
        const isNowBelowThreshold = newWeight < STALE_THRESHOLD

        const { error } = await supabase
            .from('memories')
            .update({
                decay_weight: newWeight,
                updated_at: new Date().toISOString(),
            })
            .eq('id', mem.id)

        if (!error) {
            decayed++
            if (wasAboveThreshold && isNowBelowThreshold) {
                newlyStale++
            }
        }
    }

    return { decayed, newlyStale }
}

/**
 * Count memories that recently became stale.
 */
async function countNewlyStaleMemories(organizationId?: string): Promise<number> {
    let query = supabase
        .from('memories')
        .select('id', { count: 'exact' })
        .eq('is_active', true)
        .eq('is_pinned', false)
        .lt('decay_weight', STALE_THRESHOLD)
        .eq('reinforcement_count', 0)

    if (organizationId) {
        query = query.eq('organization_id', organizationId)
    }

    const { count } = await query
    return count || 0
}

// ═══════════════════════════════════════════════════
// REINFORCEMENT ENGINE
// ═══════════════════════════════════════════════════

/**
 * Reinforce a memory — called when a memory is retrieved and used in a response.
 * Increments reinforcement_count, resets decay_weight to 1.0, updates last_accessed_at.
 */
export async function reinforceMemory(memoryId: string): Promise<void> {
    // 1. Update decay and timestamps
    await supabase
        .from('memories')
        .update({
            decay_weight: 1.0,
            last_accessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)

    // 2. Increment count atomically
    const { error: rpcError } = await supabase.rpc('increment_reinforcement', { memory_id: memoryId })

    if (rpcError) {
        // Fallback: read → write
        const { data } = await supabase
            .from('memories')
            .select('reinforcement_count')
            .eq('id', memoryId)
            .single()

        if (data) {
            await supabase
                .from('memories')
                .update({
                    reinforcement_count: ((data.reinforcement_count as number) || 0) + 1,
                })
                .eq('id', memoryId)
        }
    }
}

/**
 * Batch reinforce multiple memories at once.
 * Called after a chat response to reinforce all memories that were used.
 */
export async function reinforceMemories(memoryIds: string[]): Promise<void> {
    await Promise.allSettled(memoryIds.map(id => reinforceMemory(id)))
}

// ═══════════════════════════════════════════════════
// FEEDBACK INTEGRATION
// ═══════════════════════════════════════════════════

/**
 * Process user feedback (thumbs up/down) and link it to the memories
 * that were used in the rated response.
 *
 * Positive: boost confidence by 5%, add reinforcement
 * Negative: reduce confidence by 10%, flag for review if confidence drops below threshold
 */
export async function processFeedback(params: {
    conversationId: string
    messageId: string
    rating: 'positive' | 'negative'
    memoryIds: string[]
}): Promise<void> {
    const { rating, memoryIds } = params

    for (const memoryId of memoryIds) {
        // Get current memory state
        const { data: memory } = await supabase
            .from('memories')
            .select('confidence, reinforcement_count, metadata')
            .eq('id', memoryId)
            .single()

        if (!memory) continue

        const currentConfidence = memory.confidence as number
        const currentMeta = (memory.metadata as Record<string, unknown>) || {}

        if (rating === 'positive') {
            // Boost confidence (cap at 1.0) and reinforce
            const newConfidence = Math.min(1.0, currentConfidence * 1.05)
            await supabase
                .from('memories')
                .update({
                    confidence: newConfidence,
                    reinforcement_count: ((memory.reinforcement_count as number) || 0) + 1,
                    decay_weight: 1.0,
                    last_accessed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...currentMeta,
                        last_feedback: 'positive',
                        positive_feedback_count: ((currentMeta.positive_feedback_count as number) || 0) + 1,
                    },
                })
                .eq('id', memoryId)
        } else {
            // Reduce confidence
            const newConfidence = Math.max(0.1, currentConfidence * 0.9)
            const flagForReview = newConfidence < 0.5

            await supabase
                .from('memories')
                .update({
                    confidence: newConfidence,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...currentMeta,
                        last_feedback: 'negative',
                        negative_feedback_count: ((currentMeta.negative_feedback_count as number) || 0) + 1,
                        flagged_for_review: flagForReview || undefined,
                    },
                })
                .eq('id', memoryId)
        }

        // Log the feedback
        await supabase
            .from('memory_access_log')
            .insert({
                memory_id: memoryId,
                conversation_id: params.conversationId,
                was_helpful: rating === 'positive',
                accessed_at: new Date().toISOString(),
            })
            .then(() => { })
    }
}

// ═══════════════════════════════════════════════════
// STALE MEMORY DETECTION
// ═══════════════════════════════════════════════════

/**
 * Get all stale memories for review.
 * Stale = decay_weight < STALE_THRESHOLD AND reinforcement_count = 0
 */
export async function getStaleMemories(params: {
    organizationId?: string
    projectId?: string
    limit?: number
}): Promise<Array<{
    id: string
    content: string
    memory_type: string
    decay_weight: number
    created_at: string
    last_accessed_at: string | null
}>> {
    let query = supabase
        .from('memories')
        .select('id, content, memory_type, decay_weight, created_at, last_accessed_at')
        .eq('is_active', true)
        .eq('is_pinned', false)
        .lt('decay_weight', STALE_THRESHOLD)
        .eq('reinforcement_count', 0)
        .order('decay_weight', { ascending: true })
        .limit(params.limit || 50)

    if (params.organizationId) {
        query = query.eq('organization_id', params.organizationId)
    }
    if (params.projectId) {
        query = query.eq('project_id', params.projectId)
    }

    const { data } = await query
    return (data || []) as Array<{
        id: string
        content: string
        memory_type: string
        decay_weight: number
        created_at: string
        last_accessed_at: string | null
    }>
}

/**
 * Bulk archive stale memories (soft delete).
 */
export async function archiveStaleMemories(memoryIds: string[]): Promise<number> {
    const { data } = await supabase
        .from('memories')
        .update({
            is_active: false,
            updated_at: new Date().toISOString(),
            metadata: { archived_reason: 'stale_auto' },
        })
        .in('id', memoryIds)
        .select('id')

    return data?.length || 0
}

// ═══════════════════════════════════════════════════
// CONSOLIDATION: Layer 2 → Layer 3 Promotion
// ═══════════════════════════════════════════════════

/**
 * Promote highly-reinforced project memories to firm-level patterns.
 * A memory qualifies if reinforcement_count >= 5 and confidence >= 0.8.
 */
export async function promoteToFirmPatterns(organizationId: string): Promise<number> {
    // Find heavily reinforced memories
    const { data: candidates } = await supabase
        .from('memories')
        .select('content, memory_type, metadata, project_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .gte('reinforcement_count', 5)
        .gte('confidence', 0.8)
        .limit(50)

    if (!candidates || candidates.length === 0) return 0

    let promoted = 0

    for (const mem of candidates) {
        // Check if pattern already exists
        const { data: existing } = await supabase
            .from('firm_patterns')
            .select('id')
            .eq('organization_id', organizationId)
            .ilike('description', `%${(mem.content as string).substring(0, 50)}%`)
            .limit(1)

        if (existing && existing.length > 0) continue

        const patternType = mem.memory_type === 'risk' ? 'risk_distribution'
            : mem.memory_type === 'argument' ? 'argument_success'
            : mem.memory_type === 'procedure' ? 'procedure'
            : 'clause_frequency'

        await supabase.from('firm_patterns').insert({
            organization_id: organizationId,
            pattern_type: patternType,
            description: `Recurring ${mem.memory_type}: ${mem.content}`,
            data: {
                source_memory_type: mem.memory_type,
                source_projects: [mem.project_id],
                promoted_from: 'learning_loop',
            },
            confidence: 0.7,
            sample_size: 1,
            is_anonymized: true,
            last_computed_at: new Date().toISOString(),
        })

        promoted++
    }

    return promoted
}
