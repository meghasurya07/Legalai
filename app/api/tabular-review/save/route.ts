import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
    try {
        const { projectId, columns, cells, chatMessages } = await request.json()

        if (!projectId || !columns || !Array.isArray(columns)) {
            return apiError('Missing required fields', 400)
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
                console.error('[Tabular Review Save] Column save error:', colError)
                return apiError('Failed to save columns', 500, colError)
            }

            // Remove stale columns no longer in the set
            const currentColumnIds = columns.map((col: { id: string }) => col.id)
            await supabase
                .from('tabular_review_columns')
                .delete()
                .eq('project_id', projectId)
                .not('column_id', 'in', `(${currentColumnIds.join(',')})`)
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
                    console.error('[Tabular Review Save] Cell save error:', cellError)
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
                console.error('[Tabular Review Save] Message save error:', msgError)
            }
        }

        console.log(`[Tabular Review] Saved ${columns.length} columns, ${cells?.length || 0} cells, ${chatMessages?.length || 0} messages for project ${projectId}`)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Tabular Review Save] Error:', error)
        return apiError('Save failed', 500, error)
    }
}
