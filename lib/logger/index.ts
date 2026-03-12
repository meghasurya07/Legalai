/**
 * Structured Logger
 * 
 * Centralized event logging with persistence to system_logs.
 * All log calls are fire-and-forget to avoid blocking pipelines.
 */

import { supabase } from '@/lib/supabase/server'

export type EventType =
    | 'AI_CALL'
    | 'RAG_RETRIEVE'
    | 'DOC_ANALYSIS'
    | 'CLAUSE_EXTRACT'
    | 'WORKFLOW_STEP'
    | 'JOB_START'
    | 'JOB_COMPLETE'
    | 'JOB_ERROR'
    | 'API_REQUEST'
    | 'API_ERROR'
    | 'GRAPH_EXTRACT'
    | 'MEMORY_EXTRACT'
    | 'CONFLICT_DETECT'
    | 'INSIGHT_GEN'
    | 'SETTINGS_UPDATE'
    | 'HELP_VIEW'
    | 'SUPPORT_REQUEST'

/**
 * Log a structured event. Fire-and-forget — never throws.
 */
export function logEvent(
    eventType: EventType,
    data: Record<string, unknown>,
    projectId?: string,
    refId?: string,
    orgId?: string,
    userId?: string
): void {
    const logData = {
        event_type: eventType,
        project_id: projectId || (data.projectId as string) || null,
        ref_id: refId || (data.refId as string) || null,
        org_id: orgId || (data.orgId as string) || null,
        user_id: userId || (data.userId as string) || null,
        data
    }

    // Console for dev visibility
    console.log(`[LOG] ${eventType}`, JSON.stringify(data).slice(0, 200))

    // Persist (fire-and-forget)
    supabase
        .from('system_logs')
        .insert(logData)
        .then(({ error }) => {
            if (error) console.error('[Logger] Persist failed:', error.message)
        })
}
