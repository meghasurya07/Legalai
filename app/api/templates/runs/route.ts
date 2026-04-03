import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { callAISafe } from '@/lib/ai/client'
import { executeWorkflow } from '@/lib/workflow/engine'
import { PIPELINES } from '@/lib/workflow/pipelines'
import { getUserId } from '@/lib/get-user-id'
import { logger } from '@/lib/logger'

// POST /api/templates/runs - Create a new workflow run with real AI
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { workflowId, inputData } = body

        if (!workflowId) {
            return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
        }

        // Get workflow details for context
        const { data: workflow } = await supabase
            .from('templates')
            .select('title')
            .eq('id', workflowId)
            .single()

        // Create workflow run with 'running' status
        const { data: run, error } = await supabase
            .from('workflow_runs')
            .insert({
                workflow_id: workflowId,
                status: 'running',
                input_data: inputData || {},
                user_id: userId
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating workflow run:', error)
            return NextResponse.json({ error: 'Failed to create workflow run' }, { status: 500 })
        }

        // Resolve org context for BYOK (needed for both pipeline and legacy paths)
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch (err) { logger.error("runs/route", "Operation failed", err) }

        // Check if this workflow has a multi-step pipeline definition
        const pipeline = PIPELINES[workflowId]
        if (pipeline) {
            // execute async (fire-and-forget) to not block UI
            executeWorkflow(pipeline, inputData || {}, undefined, run.id, orgId)
                .then(async (result) => {
                    await supabase
                        .from('workflow_runs')
                        .update({
                            status: 'completed',
                            completed_at: new Date().toISOString(),
                            output_data: result
                        })
                        .eq('id', run.id)
                })
                .catch(async (err) => {
                    console.error(`Pipeline ${workflowId} failed:`, err)
                    await supabase
                        .from('workflow_runs')
                        .update({
                            status: 'failed',
                            error_message: err instanceof Error ? err.message : 'Unknown error'
                        })
                        .eq('id', run.id)
                })

            return NextResponse.json({
                id: run.id,
                workflowId: run.workflow_id,
                status: 'running', // Still running async
                createdAt: run.created_at
            }, { status: 201 })
        }

        // Fallback to Legacy Single-Step Execution
        const { result, error: aiError } = await callAISafe('workflow_execution', {
            workflowName: workflow?.title || workflowId,
            inputData: inputData || {}
        }, { orgId })

        if (aiError) {
            // Update run as failed
            await supabase
                .from('workflow_runs')
                .update({
                    status: 'failed',
                    error_message: aiError,
                    updated_at: new Date().toISOString()
                })
                .eq('id', run.id)

            return NextResponse.json({
                id: run.id,
                workflowId: run.workflow_id,
                status: 'failed',
                errorMessage: aiError,
                createdAt: run.created_at
            }, { status: 201 })
        }

        // Update run as completed with AI output
        await supabase
            .from('workflow_runs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                output_data: { message: result }
            })
            .eq('id', run.id)

        return NextResponse.json({
            id: run.id,
            workflowId: run.workflow_id,
            status: 'completed',
            outputData: { message: result },
            createdAt: run.created_at
        }, { status: 201 })
    } catch (error) {
        console.error('Error in POST /api/templates/runs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET /api/templates/runs - List workflow runs for current user
export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const workflowId = searchParams.get('workflowId')

        let query = supabase
            .from('workflow_runs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (workflowId) {
            query = query.eq('workflow_id', workflowId)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching workflow runs:', error)
            return NextResponse.json({ error: 'Failed to fetch workflow runs' }, { status: 500 })
        }

        const runs = data.map(r => ({
            id: r.id,
            workflowId: r.workflow_id,
            status: r.status,
            inputData: r.input_data,
            outputData: r.output_data,
            errorMessage: r.error_message,
            createdAt: r.created_at,
            completedAt: r.completed_at
        }))

        return NextResponse.json(runs)
    } catch (error) {
        console.error('Error in GET /api/templates/runs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
