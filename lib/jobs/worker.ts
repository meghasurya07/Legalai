/**
 * Job Queue — Worker
 * 
 * Fetches and processes pending jobs with retry support.
 */

import { supabase } from '@/lib/supabase/server'
import { executeJobHandler } from './handlers'
import { logEvent } from '@/lib/logger'
import type { Job, JobType } from './types'

/**
 * Process the next pending job.
 * Returns true if a job was processed, false if queue is empty.
 */
export async function processNextJob(): Promise<boolean> {
    try {
        // 1. Fetch oldest pending job
        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1)
            .single()

        if (error || !job) return false

        const typedJob = job as unknown as Job
        const jobId = typedJob.id

        // 2. Mark as running
        await supabase
            .from('jobs')
            .update({
                status: 'running',
                attempts: typedJob.attempts + 1,
                started_at: new Date().toISOString()
            })
            .eq('id', jobId)

        logEvent('JOB_START', {
            jobId,
            jobType: typedJob.job_type,
            attempt: typedJob.attempts + 1,
            projectId: typedJob.project_id
        })

        // 3. Execute
        try {
            await executeJobHandler(typedJob.job_type as JobType, typedJob.payload)

            // 4. Mark completed
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
                projectId: typedJob.project_id
            })

        } catch (execError) {
            const errorMessage = execError instanceof Error ? execError.message : String(execError)
            const newAttempts = typedJob.attempts + 1
            const newStatus = newAttempts >= typedJob.max_attempts ? 'failed' : 'pending'

            await supabase
                .from('jobs')
                .update({
                    status: newStatus,
                    error: errorMessage,
                    completed_at: newStatus === 'failed' ? new Date().toISOString() : null
                })
                .eq('id', jobId)

            logEvent('JOB_ERROR', {
                jobId,
                jobType: typedJob.job_type,
                error: errorMessage,
                attempt: newAttempts,
                willRetry: newStatus === 'pending',
                projectId: typedJob.project_id
            })
        }

        return true

    } catch (err) {
        console.error('[Jobs] Worker error:', err)
        return false
    }
}

/**
 * Process all pending jobs (batch drain).
 * Useful for cron-like execution.
 */
export async function processAllPendingJobs(maxJobs: number = 10): Promise<number> {
    let processed = 0
    for (let i = 0; i < maxJobs; i++) {
        const hasJob = await processNextJob()
        if (!hasJob) break
        processed++
    }
    return processed
}
