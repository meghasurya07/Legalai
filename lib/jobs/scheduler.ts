/**
 * Scheduled Maintenance — H28
 * 
 * Combines all periodic maintenance tasks into a single entry point
 * designed to be called from a cron API route or scheduled function.
 * 
 * Tasks:
 * 1. Memory decay (daily)
 * 2. Memory consolidation (weekly or on-demand)
 * 3. Importance re-evaluation (daily)
 * 4. Firm pattern promotion (weekly)
 * 5. Stale memory archival (weekly)
 */

import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase/server'

export interface MaintenanceResult {
    startedAt: string
    completedAt: string
    durationMs: number
    decay: { decayed: number; newlyStale: number }
    consolidation: { clustersFound: number; memoriesConsolidated: number; newMemoriesCreated: number }
    importance: { upgraded: number; downgraded: number }
    firmPatterns: { promoted: number }
    staleArchival: { archived: number }
    errors: string[]
}

/**
 * Run all scheduled maintenance tasks.
 * 
 * This is the main entry point for the cron job.
 * Can be called from:
 * - An API route: `/api/cron/maintenance`
 * - A Supabase Edge Function
 * - A scheduled task in the jobs queue
 * 
 * @param organizationId - Optional org scope (runs for all orgs if not specified)
 */
export async function runScheduledMaintenance(
    organizationId?: string
): Promise<MaintenanceResult> {
    const startedAt = new Date().toISOString()
    const startTime = Date.now()
    const errors: string[] = []

    const result: MaintenanceResult = {
        startedAt,
        completedAt: '',
        durationMs: 0,
        decay: { decayed: 0, newlyStale: 0 },
        consolidation: { clustersFound: 0, memoriesConsolidated: 0, newMemoriesCreated: 0 },
        importance: { upgraded: 0, downgraded: 0 },
        firmPatterns: { promoted: 0 },
        staleArchival: { archived: 0 },
        errors: [],
    }

    logger.info("jobs/scheduler", `[Scheduler] Starting maintenance run${organizationId ? ` for org ${organizationId}` : ' (all orgs)'}`)

    // 1. Memory Decay
    try {
        const { applyMemoryDecay } = await import('@/lib/memory/learning-loop')
        const decayResult = await applyMemoryDecay(organizationId)
        result.decay = decayResult
        logger.info("jobs/scheduler", `[Scheduler] Decay: ${decayResult.decayed} decayed, ${decayResult.newlyStale} newly stale`)
    } catch (err) {
        const msg = `Decay failed: ${err instanceof Error ? err.message : 'unknown'}`
        errors.push(msg)
        logger.error("jobs/scheduler", msg, err)
    }

    // 2. Get active projects for per-project tasks
    let projectIds: string[] = []
    try {
        let query = supabase
            .from('projects')
            .select('id')
            .limit(100)

        if (organizationId) {
            query = query.eq('organization_id', organizationId)
        }

        const { data: projects } = await query
        projectIds = (projects || []).map(p => p.id)
    } catch (err) {
        const msg = `Project listing failed: ${err instanceof Error ? err.message : 'unknown'}`
        errors.push(msg)
        logger.error("jobs/scheduler", msg, err)
    }

    // 3. Memory Consolidation (per project)
    try {
        const { consolidateMemories } = await import('@/lib/memory/consolidation')
        for (const projectId of projectIds) {
            const consolResult = await consolidateMemories(projectId)
            result.consolidation.clustersFound += consolResult.clustersFound
            result.consolidation.memoriesConsolidated += consolResult.memoriesConsolidated
            result.consolidation.newMemoriesCreated += consolResult.newMemoriesCreated
        }
        logger.info("jobs/scheduler",
            `[Scheduler] Consolidation: ${result.consolidation.clustersFound} clusters, ` +
            `${result.consolidation.memoriesConsolidated} consolidated, ` +
            `${result.consolidation.newMemoriesCreated} new`
        )
    } catch (err) {
        const msg = `Consolidation failed: ${err instanceof Error ? err.message : 'unknown'}`
        errors.push(msg)
        logger.error("jobs/scheduler", msg, err)
    }

    // 4. Importance Re-evaluation (per project)
    try {
        const { reevaluateImportance } = await import('@/lib/memory/learning-loop')
        for (const projectId of projectIds) {
            const impResult = await reevaluateImportance(projectId)
            result.importance.upgraded += impResult.upgraded
            result.importance.downgraded += impResult.downgraded
        }
        logger.info("jobs/scheduler",
            `[Scheduler] Importance: ${result.importance.upgraded} upgraded, ${result.importance.downgraded} downgraded`
        )
    } catch (err) {
        const msg = `Importance re-eval failed: ${err instanceof Error ? err.message : 'unknown'}`
        errors.push(msg)
        logger.error("jobs/scheduler", msg, err)
    }

    // 5. Firm Pattern Promotion
    if (organizationId) {
        try {
            const { promoteToFirmPatterns } = await import('@/lib/memory/learning-loop')
            const promoted = await promoteToFirmPatterns(organizationId)
            result.firmPatterns.promoted = promoted
            logger.info("jobs/scheduler", `[Scheduler] Firm patterns: ${promoted} promoted`)
        } catch (err) {
            const msg = `Firm pattern promotion failed: ${err instanceof Error ? err.message : 'unknown'}`
            errors.push(msg)
            logger.error("jobs/scheduler", msg, err)
        }
    }

    // 6. Stale Memory Archival
    try {
        const { getStaleMemories, archiveStaleMemories } = await import('@/lib/memory/learning-loop')
        const staleMemories = await getStaleMemories({
            organizationId,
            limit: 100,
        })

        if (staleMemories.length > 0) {
            const archived = await archiveStaleMemories(staleMemories.map(m => m.id))
            result.staleArchival.archived = archived
            logger.info("jobs/scheduler", `[Scheduler] Archived ${archived} stale memories`)
        }
    } catch (err) {
        const msg = `Stale archival failed: ${err instanceof Error ? err.message : 'unknown'}`
        errors.push(msg)
        logger.error("jobs/scheduler", msg, err)
    }

    const durationMs = Date.now() - startTime
    result.completedAt = new Date().toISOString()
    result.durationMs = durationMs
    result.errors = errors

    logger.info("jobs/scheduler",
        `[Scheduler] Maintenance complete in ${durationMs}ms — ` +
        `decay=${result.decay.decayed}, consolidated=${result.consolidation.memoriesConsolidated}, ` +
        `importance=${result.importance.upgraded}↑/${result.importance.downgraded}↓, ` +
        `patterns=${result.firmPatterns.promoted}, archived=${result.staleArchival.archived}, ` +
        `errors=${errors.length}`
    )

    return result
}
