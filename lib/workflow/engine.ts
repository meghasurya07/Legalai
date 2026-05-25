/**
 * Workflow Engine — Main Logic
 * 
 * Orchestrates multi-step reasoning pipelines.
 * 
 * KEY UPGRADES:
 * - H34: Partial results — if a step fails, completed steps' results are preserved
 * - H36: Progress callback — callers can track step-by-step progress
 */

import { WorkflowPipeline, WorkflowContext, StepExecutionResult } from './types'
import { executeStep } from './steps'
import { supabase } from '@/lib/supabase/server'
import { retrieveProjectAnalysis, retrieveClauses } from '@/lib/document-intelligence'
import { logger } from '@/lib/logger'

/**
 * H36: Progress callback for real-time step progress.
 */
export interface WorkflowProgress {
    stepId: string
    stepName: string
    stepIndex: number
    totalSteps: number
    status: 'running' | 'completed' | 'failed' | 'skipped'
    /** Progress as fraction (0.0 to 1.0) */
    progress: number
    error?: string
}

export type ProgressCallback = (progress: WorkflowProgress) => void

/**
 * H34: Execution result with partial results support.
 */
export interface WorkflowExecutionResult {
    /** The final output (last completed step) */
    output: Record<string, unknown>
    /** Results from all steps, including partial results */
    stepResults: Record<string, StepExecutionResult>
    /** Whether the workflow completed fully */
    completed: boolean
    /** Number of steps that completed successfully */
    completedSteps: number
    /** Total steps in the pipeline */
    totalSteps: number
    /** Error message if workflow didn't complete */
    error?: string
}

/**
 * Execute a workflow pipeline.
 * 
 * H34: On step failure, saves all completed results rather than throwing.
 * H36: Calls progressCallback after each step for real-time UI updates.
 */
export async function executeWorkflow(
    pipeline: WorkflowPipeline,
    inputs: Record<string, unknown>,
    projectId?: string,
    workflowRunId?: string,
    orgId?: string,
    progressCallback?: ProgressCallback
): Promise<WorkflowExecutionResult> {

    // 1. Initialize Context
    const context: WorkflowContext = {
        workflowRunId: workflowRunId || '',
        projectId,
        orgId,
        inputs,
        stepResults: {},
        documentAnalysis: [],
        clauses: []
    }

    // 2. Hydrate Project Context (if applicable)
    if (projectId) {
        try {
            const [analysis, clauses] = await Promise.all([
                retrieveProjectAnalysis(projectId),
                retrieveClauses(projectId)
            ])
            context.documentAnalysis = analysis
            context.clauses = clauses
        } catch (error) {
            logger.error('workflow/engine', 'Failed to hydrate context', error)
        }
    }

    // 3. Execute Steps (H34: with partial result preservation)
    const allStepResults: Record<string, StepExecutionResult> = {}
    let lastSuccessfulOutput: Record<string, unknown> = {}
    let completedSteps = 0
    let workflowError: string | undefined

    for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i]
        logger.info("workflow/engine", `[WorkflowEngine] Executing step ${i + 1}/${pipeline.steps.length}: ${step.name} (${step.type})`)

        // H36: Notify progress — step starting
        if (progressCallback) {
            try {
                progressCallback({
                    stepId: step.id,
                    stepName: step.name,
                    stepIndex: i,
                    totalSteps: pipeline.steps.length,
                    status: 'running',
                    progress: i / pipeline.steps.length,
                })
            } catch {
                // Don't let callback errors break the workflow
            }
        }

        // Create initial step record in DB
        let stepRecordId = ''
        if (workflowRunId) {
            const { data: stepRec } = await supabase
                .from('workflow_steps')
                .insert({
                    workflow_run_id: workflowRunId,
                    step_index: i,
                    step_type: step.type,
                    step_name: step.name,
                    status: 'running',
                    input_context: inputs
                })
                .select()
                .single()
            stepRecordId = stepRec?.id
        }

        let result: StepExecutionResult
        try {
            result = await executeStep(step, context)
        } catch (err) {
            result = {
                stepId: step.id,
                stepName: step.name,
                status: 'failed',
                output: {},
                tokensUsed: 0,
                error: err instanceof Error ? err.message : 'Unknown error',
            }
        }

        // Store the result regardless of status (H34)
        allStepResults[step.id] = result

        // Update step record in DB
        if (stepRecordId) {
            await supabase
                .from('workflow_steps')
                .update({
                    status: result.status,
                    output_payload: result.output,
                    tokens_used: result.tokensUsed || 0,
                    error_message: result.error,
                    completed_at: new Date().toISOString()
                })
                .eq('id', stepRecordId)
        }

        if (result.status === 'failed') {
            logger.warn("workflow/engine", `[WorkflowEngine] Step ${step.name} failed: ${result.error}`)

            // H34: Check if the NEXT step depends on this step's output
            // If the next step needs ALL or this step's specific context, we must stop
            // If it's independent (NONE source), we can continue
            const nextStep = pipeline.steps[i + 1]
            const mustStop = !nextStep || 
                nextStep.contextSource === 'ALL' || 
                nextStep.contextSource === step.type.replace('_', '') as typeof nextStep.contextSource

            if (mustStop) {
                workflowError = `Step "${step.name}" failed: ${result.error}. ${completedSteps} of ${pipeline.steps.length} steps completed.`
                
                // H36: Notify — step failed, workflow stopping
                if (progressCallback) {
                    try {
                        progressCallback({
                            stepId: step.id,
                            stepName: step.name,
                            stepIndex: i,
                            totalSteps: pipeline.steps.length,
                            status: 'failed',
                            progress: i / pipeline.steps.length,
                            error: result.error,
                        })
                    } catch { /* ignore */ }
                }
                break
            } else {
                // Can continue — skip this step's output
                logger.info("workflow/engine", `[WorkflowEngine] Continuing despite failure — next step "${nextStep.name}" doesn't require this step's output`)
                
                if (progressCallback) {
                    try {
                        progressCallback({
                            stepId: step.id,
                            stepName: step.name,
                            stepIndex: i,
                            totalSteps: pipeline.steps.length,
                            status: 'failed',
                            progress: (i + 1) / pipeline.steps.length,
                            error: result.error,
                        })
                    } catch { /* ignore */ }
                }
                continue
            }
        }

        // Success — store result for next steps
        context.stepResults[step.id] = result.output
        lastSuccessfulOutput = result.output
        completedSteps++

        // H36: Notify progress — step completed
        if (progressCallback) {
            try {
                progressCallback({
                    stepId: step.id,
                    stepName: step.name,
                    stepIndex: i,
                    totalSteps: pipeline.steps.length,
                    status: 'completed',
                    progress: (i + 1) / pipeline.steps.length,
                })
            } catch { /* ignore */ }
        }
    }

    // 4. Memory + Graph Extraction (via job queue) — only if we have results
    if (projectId && completedSteps > 0) {
        const text = JSON.stringify(lastSuccessfulOutput)
        import('@/lib/jobs').then(j => {
            j.enqueueJob('MEMORY_EXTRACTION', {
                projectId,
                text,
                source: 'workflow',
                sourceId: workflowRunId
            }, projectId)
            j.enqueueJob('GRAPH_BUILD', {
                projectId,
                text,
                source: 'workflow',
                refId: workflowRunId
            }, projectId)
        }).catch(err => logger.error('workflow/engine', 'Job enqueue failed', err))
    }

    return {
        output: lastSuccessfulOutput,
        stepResults: allStepResults,
        completed: completedSteps === pipeline.steps.length,
        completedSteps,
        totalSteps: pipeline.steps.length,
        error: workflowError,
    }
}
