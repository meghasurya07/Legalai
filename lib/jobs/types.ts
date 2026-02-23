/**
 * Job Queue — Type Definitions
 */

export type JobType =
    | 'RAG_INGEST'
    | 'DOC_ANALYSIS'
    | 'CLAUSE_EXTRACTION'
    | 'WORKFLOW_RUN'
    | 'MEMORY_EXTRACTION'
    | 'GRAPH_BUILD'
    | 'INSIGHT_GEN'
    | 'PROJECT_SUMMARY'
    | 'CONFLICT_DETECTION'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job {
    id: string
    job_type: JobType
    payload: Record<string, unknown>
    status: JobStatus
    attempts: number
    max_attempts: number
    error: string | null
    project_id: string
    created_at: string
    started_at: string | null
    completed_at: string | null
}
