/**
 * Job Queue — Dispatcher
 * 
 * Enqueues jobs into the persistent job table.
 */

import { supabase } from '@/lib/supabase/server'
import type { JobType } from './types'
import { logger } from '@/lib/logger'

/**
 * Enqueue a background job.
 * Returns the job ID for tracking.
 */
export async function enqueueJob(
    type: JobType,
    payload: Record<string, unknown>,
    projectId: string,
    maxAttempts: number = 3
): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .insert({
                job_type: type,
                payload,
                status: 'pending',
                attempts: 0,
                max_attempts: maxAttempts,
                project_id: projectId
            })
            .select('id')
            .single()

        if (error) {
            logger.error('lib', `[Jobs] Failed to enqueue ${type}:`, error)
            return null
        }

        logger.info("jobs/dispatcher", `[Jobs] Enqueued ${type} job: ${data.id}`)
        return data.id
    } catch (err) {
        logger.error('lib', `[Jobs] Dispatch error for ${type}:`, err)
        return null
    }
}
