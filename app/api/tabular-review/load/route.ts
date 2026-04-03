import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/get-user-id'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return apiError('Missing projectId', 400)
        }

        // Verify project ownership
        const { data: project, error: projError } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .eq('user_id', userId)
            .single()

        if (projError || !project) {
            return apiError('Project not found', 404)
        }

        // Load columns
        const { data: columnRows, error: colError } = await supabase
            .from('tabular_review_columns')
            .select('*')
            .eq('project_id', projectId)
            .order('order', { ascending: true })

        if (colError) {
            console.error('[Tabular Review Load] Column load error:', colError)
            return apiError('Failed to load columns', 500, colError)
        }

        // Load cells
        const { data: cellRows, error: cellError } = await supabase
            .from('tabular_review_cells')
            .select('*')
            .eq('project_id', projectId)

        if (cellError) {
            console.error('[Tabular Review Load] Cell load error:', cellError)
            return apiError('Failed to load cells', 500, cellError)
        }

        // Transform to frontend format
        const columns = (columnRows || []).map(row => ({
            id: row.column_id,
            name: row.name,
            prompt: row.prompt,
            width: row.width || 220,
            order: row.order || 0,
        }))

        const cells = (cellRows || []).map(row => ({
            documentId: row.file_id,
            columnId: row.column_id,
            content: row.content,
            status: row.status,
        }))

        // Load chat messages
        const { data: messageRows } = await supabase
            .from('tabular_review_messages')
            .select('*')
            .eq('project_id', projectId)
            .order('order', { ascending: true })

        const chatMessages = (messageRows || []).map(row => ({
            role: row.role,
            content: row.content,
        }))

        logger.info("load/route", `[Tabular Review] Loaded ${columns.length} columns, ${cells.length} cells, ${chatMessages.length} messages for project ${projectId}`)

        return NextResponse.json({ columns, cells, chatMessages })
    } catch (error) {
        console.error('[Tabular Review Load] Error:', error)
        return apiError('Load failed', 500, error)
    }
}
