/**
 * Job Queue — Dispatcher
 * 
 * Enqueues jobs into the persistent job table.
 */

import { supabase } from '@/lib/supabase/server'
import type { JobType } from './types'

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
            console.error(`[Jobs] Failed to enqueue ${type}:`, error)
            return null
        }

        console.log(`[Jobs] Enqueued ${type} job: ${data.id}`)
        return data.id
    } catch (err) {
        console.error(`[Jobs] Dispatch error for ${type}:`, err)
        return null
    }
}
