/**
 * Workflow Engine — Main Logic
 * 
 * Orchestrates multi-step reasoning pipelines.
 */

import { WorkflowPipeline, WorkflowContext } from './types'
import { executeStep } from './steps'
import { supabase } from '@/lib/supabase/server'
import { retrieveProjectAnalysis, retrieveClauses } from '@/lib/document-intelligence'

/**
 * Execute a workflow pipeline.
 */
export async function executeWorkflow(
    pipeline: WorkflowPipeline,
    inputs: Record<string, unknown>,
    projectId?: string,
    workflowRunId?: string
): Promise<Record<string, unknown>> {

    // 1. Initialize Context
    const context: WorkflowContext = {
        workflowRunId: workflowRunId || '',
        projectId,
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
            console.error('[WorkflowEngine] Failed to hydrate context:', error)
        }
    }

    // 3. Execute Steps
    let finalResult = {}

    for (const step of pipeline.steps) {
        console.log(`[WorkflowEngine] Executing step: ${step.name} (${step.type})`)

        // Create initial step record
        let stepRecordId = ''
        if (workflowRunId) {
            const { data: stepRec } = await supabase
                .from('workflow_steps')
                .insert({
                    workflow_run_id: workflowRunId,
                    step_index: pipeline.steps.indexOf(step),
                    step_type: step.type,
                    step_name: step.name,
                    status: 'running',
                    input_context: inputs // simplifies for now, ideal would be step-specific context
                })
                .select()
                .single()
            stepRecordId = stepRec?.id
        }

        const result = await executeStep(step, context)

        // Update step record
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
            throw new Error(`Step ${step.name} failed: ${result.error}`)
        }

        // Store result for next steps
        context.stepResults[step.id] = result.output
        finalResult = result.output
    }

    // 4. Memory + Graph Extraction (via job queue)
    if (projectId && finalResult) {
        const text = JSON.stringify(finalResult)
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
        }).catch(err => console.error('[WorkflowEngine] Job enqueue failed:', err))
    }

    return finalResult
}
