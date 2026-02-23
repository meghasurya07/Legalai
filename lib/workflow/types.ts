/**
 * Workflow Engine — Core Types
 * 
 * Defines the structure for multi-step workflow pipelines.
 */

export type StepType =
    | 'CLAUSE_ANALYSIS'
    | 'RISK_ASSSESSMENT'
    | 'RAG_QUERY'
    | 'DOCUMENT_COMPARISON'
    | 'SYNTHESIS'
    | 'METADATA_ANALYSIS'

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface WorkflowStepDefinition {
    id: string
    type: StepType
    name: string
    promptTemplate: string
    contextSource: 'RAG' | 'CLAUSES' | 'METADATA' | 'NONE' | 'ALL'
    outputSchema?: Record<string, unknown>
}

export interface WorkflowPipeline {
    id: string
    name: string
    description: string
    steps: WorkflowStepDefinition[]
}

export interface StepExecutionResult {
    stepId: string
    stepName: string
    status: StepStatus
    output: Record<string, unknown>
    tokensUsed: number
    error?: string
}

export interface WorkflowContext {
    workflowRunId: string
    projectId?: string
    inputs: Record<string, unknown>
    stepResults: Record<string, unknown> // map of stepId -> output
    documentAnalysis?: unknown[]
    clauses?: unknown[]
}
