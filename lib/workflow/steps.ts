/**
 * Workflow Engine — Step Implementations
 * 
 * Standard step types for the workflow engine.
 */

import { WorkflowContext, WorkflowStepDefinition, StepExecutionResult } from './types'
import { callAI } from '@/lib/ai/client'
import { truncateText } from '@/lib/ai/client'

/**
 * Base Step Executor
 */
export async function executeStep(step: WorkflowStepDefinition, context: WorkflowContext): Promise<StepExecutionResult> {
    try {
        // 1. Build Context
        const promptContext = buildStepContext(step, context)

        // 2. Execute AI Call
        let result: Record<string, unknown> = {}
        const { result: aiOutput, tokensUsed } = await callAI('workflow_execution', {
            workflowName: step.name,
            inputData: {
                instruction: step.promptTemplate,
                context: promptContext
            }
        }, {
            jsonMode: true,
            projectId: context.projectId,
            useRAG: step.contextSource === 'RAG' || step.contextSource === 'ALL'
        })

        try {
            result = JSON.parse(aiOutput)
        } catch {
            result = { message: aiOutput }
        }

        return {
            stepId: step.id,
            stepName: step.name,
            status: 'completed',
            output: result,
            tokensUsed
        }

    } catch (error) {
        return {
            stepId: step.id,
            stepName: step.name,
            status: 'failed',
            output: {},
            tokensUsed: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Build context for a step based on its configuration.
 */
function buildStepContext(step: WorkflowStepDefinition, context: WorkflowContext): string {
    let contextString = ''

    // 1. Add Previous Step Outputs
    if (Object.keys(context.stepResults).length > 0) {
        contextString += 'PREVIOUS STEPS:\n'
        for (const result of Object.values(context.stepResults)) {
            contextString += `- Step Output: ${JSON.stringify(result)}\n`
        }
        contextString += '\n'
    }

    // 2. Add Inputs
    contextString += `INPUTS:\n${JSON.stringify(context.inputs, null, 2)}\n\n`

    // 3. Add Document Intelligence (if requested)
    if (step.contextSource === 'CLAUSES' || step.contextSource === 'ALL') {
        if (context.clauses && context.clauses.length > 0) {
            contextString += 'RELEVANT CLAUSES:\n'
            contextString += context.clauses.slice(0, 10).map((clause) => {
                const c = clause as Record<string, unknown>
                return `- [${c.clauseType}] ${truncateText((c.content as string), 200)}`
            }).join('\n')
            contextString += '\n\n'
        }
    }

    if (step.contextSource === 'METADATA' || step.contextSource === 'ALL') {
        if (context.documentAnalysis && context.documentAnalysis.length > 0) {
            contextString += 'DOCUMENT SUMMARIES:\n'
            contextString += context.documentAnalysis.map((analysis) => {
                const a = analysis as Record<string, unknown>
                return `- ${a.summary}`
            }).join('\n')
            contextString += '\n\n'
        }
    }

    return contextString
}
