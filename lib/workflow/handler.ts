import { NextRequest, NextResponse } from 'next/server'
import { callAISafe } from '@/lib/ai/client'
import { extractText } from '@/lib/ai/extract-text'
import { UseCase } from '@/lib/ai/prompts'
import { apiError, parseAIJSON } from '@/lib/api-utils'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

interface WorkflowConfig {
    fileField?: string | string[]
    promptType: UseCase
    additionalFields?: string[]
    responseKey?: string
    inputMode?: 'form' | 'json'
    workflowId?: string
    projectId?: string
}

export async function handleWorkflowRequest(request: NextRequest, config: WorkflowConfig) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        let inputData: Record<string, unknown> = {}
        const variables: Record<string, unknown> = {}

        if (config.inputMode === 'json') {
            inputData = await request.json()
            Object.assign(variables, inputData)
        } else {
            const formData = await request.formData()

            // Handle additional form fields
            if (config.additionalFields) {
                for (const field of config.additionalFields) {
                    const val = formData.get(field)
                    if (typeof val === 'string' && val) {
                        variables[field] = val
                    }
                }
            }

            // Handle file extraction
            if (config.fileField) {
                const fields = Array.isArray(config.fileField) ? config.fileField : [config.fileField]
                for (const field of fields) {
                    const file = formData.get(field)
                    if (!file || !(file instanceof File)) {
                        return apiError(`${field} is required and must be a file`, 400)
                    }
                    const text = await extractText(file)

                    // Assign to specific keys if needed, or default 'text'
                    if (field === 'original' || field === 'document1') variables.text1 = text
                    else if (field === 'revised' || field === 'document2') variables.text2 = text
                    else variables.text = text
                }
            }
        }

        const { result, error } = await callAISafe(config.promptType, variables, {
            jsonMode: true,
            ...(config.projectId ? { projectId: config.projectId, useRAG: true } : {})
        })

        if (error) {
            return apiError(error, 503)
        }

        const parsedResult = parseAIJSON(result, config.responseKey)

        // Persist to database if workflowId is provided
        if (config.workflowId && userId) {
            try {
                // Generate a title based on input variables
                let title = `Workflow: ${config.workflowId}`
                if (variables.company) title = `Company Profile: ${variables.company}`
                else if (variables.topic) title = `Alert: ${variables.topic}`
                else if (variables.template) title = `Draft: ${variables.template}`
                else if (variables.question) title = `Memo: ${variables.question}`
                else title = `${config.workflowId} Execution`

                // Create conversation
                const { data: conversation, error: convError } = await supabase
                    .from('conversations')
                    .insert({
                        title,
                        type: 'workflow',
                        workflow_id: config.workflowId,
                        user_id: userId
                    })
                    .select()
                    .single()

                if (!convError && conversation) {
                    // Save result as assistant message
                    await supabase.from('messages').insert({
                        conversation_id: conversation.id,
                        role: 'assistant',
                        content: typeof parsedResult === 'string' ? parsedResult : JSON.stringify(parsedResult, null, 2)
                    })
                }
            } catch (persistError) {
                logger.error('workflow', 'Failed to persist workflow execution', persistError)
            }
        }

        return NextResponse.json(parsedResult)

    } catch (error: unknown) {
        logger.error('workflow', 'Workflow execution failed', error)
        return apiError('Workflow execution failed. Please try again.', 500)
    }
}
