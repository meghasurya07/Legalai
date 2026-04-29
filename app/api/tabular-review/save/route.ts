import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth
        if (!userId) return apiError('Unauthorized', 401)

        const body = await request.json()
        const { validateUUID, sanitizeObject } = await import('@/lib/validation')

        const projectId = validateUUID(body.projectId)
        const columns = Array.isArray(body.columns) ? sanitizeObject(body.columns, 2000) : null
        const cells = Array.isArray(body.cells) ? sanitizeObject(body.cells, 100000) : undefined
        const chatMessages = Array.isArray(body.chatMessages) ? sanitizeObject(body.chatMessages, 50000) : undefined

        if (!projectId || !columns) {
            return apiError('Missing required fields', 400)
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

        // 1. Upsert columns (handles concurrent saves gracefully)
        if (columns.length > 0) {
            const columnRows = columns.map((col: { id: string; name: string; prompt: string; width: number; order: number }) => ({
                project_id: projectId,
                column_id: col.id,
                name: col.name,
                prompt: col.prompt,
                width: col.width || 220,
                order: col.order || 0,
            }))

            const { error: colError } = await supabase
                .from('tabular_review_columns')
                .upsert(columnRows, { onConflict: 'project_id,column_id' })

            if (colError) {
                logger.error('Tabular Review Save] Column save error:', 'Error', colError)
                return apiError('Failed to save columns', 500, colError)
            }

            // Remove stale columns no longer in the set
            const currentColumnIds = columns
                .map((col: { id: string }) => col.id)
                .filter((id: string) => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id))
            
            if (currentColumnIds.length > 0) {
                await supabase
                    .from('tabular_review_columns')
                    .delete()
                    .eq('project_id', projectId)
                    .not('column_id', 'in', `(${currentColumnIds.join(',')})`)
            }
        } else {
            // No columns — clear all
            await supabase
                .from('tabular_review_columns')
                .delete()
                .eq('project_id', projectId)
        }

        // 2. Upsert cells (only completed ones worth saving)
        if (cells && Array.isArray(cells) && cells.length > 0) {
            const cellRows = cells
                .filter((c: { status: string }) => c.status === 'completed')
                .map((cell: { documentId: string; columnId: string; content: string; status: string }) => ({
                    project_id: projectId,
                    file_id: cell.documentId,
                    column_id: cell.columnId,
                    content: cell.content,
                    status: cell.status,
                    updated_at: new Date().toISOString(),
                }))

            if (cellRows.length > 0) {
                const { error: cellError } = await supabase
                    .from('tabular_review_cells')
                    .upsert(cellRows, { onConflict: 'project_id,file_id,column_id' })

                if (cellError) {
                    logger.error('Tabular Review Save] Cell save error:', 'Error', cellError)
                    return apiError('Failed to save cells', 500, cellError)
                }
            }
        }

        // 3. Save chat messages (replace all for this project)
        if (chatMessages && Array.isArray(chatMessages) && chatMessages.length > 0) {
            await supabase
                .from('tabular_review_messages')
                .delete()
                .eq('project_id', projectId)

            const msgRows = chatMessages.map((msg: { role: string; content: string }, i: number) => ({
                project_id: projectId,
                role: msg.role,
                content: msg.content,
                order: i,
            }))

            const { error: msgError } = await supabase
                .from('tabular_review_messages')
                .insert(msgRows)

            if (msgError) {
                logger.error('Tabular Review Save] Message save error:', 'Error', msgError)
            }
        }

        logger.info("save/route", `[Tabular Review] Saved ${columns.length} columns, ${cells?.length || 0} cells, ${chatMessages?.length || 0} messages for project ${projectId}`)
        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error('Tabular Review Save] Error:', 'Error', error)
        return apiError('Save failed', 500, error)
    }
}