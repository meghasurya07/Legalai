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
    // Security events
    | 'AUTH_FAILED'
    | 'AUTH_SUCCESS'
    | 'RATE_LIMIT_HIT'
    | 'SUSPICIOUS_ACTIVITY'

const isDev = process.env.NODE_ENV !== 'production'

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

    if (isDev) {
        console.log(`[LOG] ${eventType}`, JSON.stringify(data).slice(0, 200))
    }

    // Persist (fire-and-forget)
    supabase
        .from('system_logs')
        .insert(logData)
        .then(({ error }) => {
            if (error) console.error('[Logger] Persist failed:', error.message)
        })
}

// ---------------------------------------------------------------------------
// General-purpose logger helpers (console-only, no DB persistence)
// Use these in place of raw console.log/warn/error throughout the codebase.
// ---------------------------------------------------------------------------

function formatMsg(level: string, context: string, msg: string, meta?: unknown): string {
    const ts = new Date().toISOString()
    const base = `[${ts}] [${level}] [${context}] ${msg}`
    if (meta !== undefined) return `${base} ${JSON.stringify(meta, null, 0)?.slice(0, 300)}`
    return base
}

export const logger = {
    /** Informational messages. Only prints in development. */
    info(context: string, msg: string, meta?: unknown) {
        if (isDev) console.log(formatMsg('INFO', context, msg, meta))
    },
    /** Warnings. Always prints. */
    warn(context: string, msg: string, meta?: unknown) {
        console.warn(formatMsg('WARN', context, msg, meta))
    },
    /** Errors. Always prints. */
    error(context: string, msg: string, error?: unknown) {
        const errInfo = error instanceof Error
            ? { message: error.message, stack: error.stack?.split('\n').slice(0, 3).join('\n') }
            : error
        console.error(formatMsg('ERROR', context, msg, errInfo))
    },
}
