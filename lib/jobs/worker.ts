import { logger } from '@/lib/logger'
/**
 * Job Queue — Worker (Production Upgrade)
 * 
 * KEY UPGRADES:
 * - H24: Concurrent job processing (configurable concurrency)
 * - H25: Atomic job claiming via RPC (SELECT ... FOR UPDATE SKIP LOCKED)
 * - H26: Exponential backoff on retry — failed jobs are delayed proportionally
 * - H27: Dead-letter tracking — failed jobs after max_attempts get flagged
 */

import { supabase } from '@/lib/supabase/server'
import { executeJobHandler } from './handlers'
import { logEvent } from '@/lib/logger'
import type { Job, JobType } from './types'

/**
 * Atomically claim the next pending job.
 * 
 * Tries to use the `claim_next_job` RPC (which uses SELECT ... FOR UPDATE SKIP LOCKED).
 * Falls back to a simple SELECT+UPDATE if the RPC is unavailable.
 * 
 * This prevents two workers from picking up the same job.
 */
async function claimNextJob(): Promise<Job | null> {
    // Try atomic claim via RPC first
    try {
        const { data, error } = await supabase.rpc('claim_next_job')
        if (!error && data && data.length > 0) {
            return data[0] as unknown as Job
        }
        if (error && !error.message.includes('does not exist')) {
            logger.error('[Jobs] claim_next_job RPC error:', 'Error occurred', error)
        }
    } catch {
        // RPC not deployed — fall through to legacy
    }

    // Fallback: non-atomic claim (legacy behavior)
    // Only fetch jobs whose next_run_after has passed (supports backoff)
    const { data: job, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'pending')
        .or(`next_run_after.is.null,next_run_after.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

    if (error || !job) return null

    const typedJob = job as unknown as Job

    // Mark as running (non-atomic — risk of duplicate processing without RPC)
    await supabase
        .from('jobs')
        .update({
            status: 'running',
            attempts: typedJob.attempts + 1,
            started_at: new Date().toISOString()
        })
        .eq('id', typedJob.id)
        .eq('status', 'pending') // Extra guard — only update if still pending

    return typedJob
}

/**
 * Calculate exponential backoff delay for a failed job.
 * Base: 30 seconds, doubling each attempt: 30s, 60s, 120s, 240s, ...
 * Capped at 15 minutes.
 */
function calculateBackoffDelay(attempt: number): number {
    const baseDelay = 30_000 // 30 seconds
    const maxDelay = 15 * 60_000 // 15 minutes
    const delay = baseDelay * Math.pow(2, attempt - 1)
    const jitter = delay * (0.8 + Math.random() * 0.4) // ±20% jitter
    return Math.min(jitter, maxDelay)
}

/**
 * Process the next pending job.
 * Returns true if a job was processed, false if queue is empty.
 */
export async function processNextJob(): Promise<boolean> {
    try {
        const typedJob = await claimNextJob()
        if (!typedJob) return false

        const jobId = typedJob.id

        logEvent('JOB_START', {
            jobId,
            jobType: typedJob.job_type,
            attempt: typedJob.attempts + 1,
            projectId: typedJob.project_id
        })

        // Execute
        const startTime = Date.now()
        try {
            await executeJobHandler(typedJob.job_type as JobType, typedJob.payload)

            const duration = Date.now() - startTime

            // Mark completed
            await supabase
                .from('jobs')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', jobId)

            logEvent('JOB_COMPLETE', {
                jobId,
                jobType: typedJob.job_type,
                durationMs: duration,
                projectId: typedJob.project_id
            })

        } catch (execError) {
            const duration = Date.now() - startTime
            const errorMessage = execError instanceof Error ? execError.message : String(execError)
            const newAttempts = typedJob.attempts + 1
            const maxReached = newAttempts >= typedJob.max_attempts
            const newStatus = maxReached ? 'failed' : 'pending'

            // Calculate backoff for retry
            const backoffMs = calculateBackoffDelay(newAttempts)
            const nextRunAfter = maxReached
                ? null
                : new Date(Date.now() + backoffMs).toISOString()

            await supabase
                .from('jobs')
                .update({
                    status: newStatus,
                    error: errorMessage,
                    completed_at: maxReached ? new Date().toISOString() : null,
                    // Set next_run_after as actual column for backoff scheduling
                    next_run_after: nextRunAfter,
                    // Store diagnostic info in metadata
                    metadata: {
                        ...(typedJob.payload?.metadata || {}),
                        last_error: errorMessage,
                        last_attempt_at: new Date().toISOString(),
                        last_attempt_duration_ms: duration,
                        ...(maxReached ? { dead_letter: true, dead_letter_at: new Date().toISOString() } : {}),
                    }
                })
                .eq('id', jobId)

            logEvent('JOB_ERROR', {
                jobId,
                jobType: typedJob.job_type,
                error: errorMessage,
                attempt: newAttempts,
                durationMs: duration,
                willRetry: !maxReached,
                backoffMs: maxReached ? 0 : backoffMs,
                deadLetter: maxReached,
                projectId: typedJob.project_id
            })
        }

        return true

    } catch (err) {
        logger.error('[Jobs] Worker error:', 'Error occurred', err)
        return false
    }
}

/**
 * Process pending jobs concurrently (H24).
 * 
 * @param maxJobs - Maximum total jobs to process in this batch
 * @param concurrency - Number of jobs to process simultaneously (default: 3)
 */
export async function processAllPendingJobs(
    maxJobs: number = 10,
    concurrency: number = 3
): Promise<number> {
    let processed = 0
    let activePromises: Promise<boolean>[] = []

    for (let i = 0; i < maxJobs; i++) {
        // Launch a job processing task
        const promise = processNextJob().then(hasJob => {
            if (hasJob) processed++
            return hasJob
        })

        activePromises.push(promise)

        // When we hit concurrency limit, wait for one to finish
        if (activePromises.length >= concurrency) {
            const results = await Promise.all(activePromises)
            activePromises = []

            // If none of the batch had jobs, queue is empty
            if (results.every(r => !r)) break
        }
    }

    // Wait for any remaining
    if (activePromises.length > 0) {
        await Promise.all(activePromises)
    }

    return processed
}
