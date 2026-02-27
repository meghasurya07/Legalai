import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { deleteFileChunks } from '@/lib/rag'

interface RouteParams {
    params: Promise<{ id: string; fileId: string }>
}

// DELETE /api/documents/projects/[id]/files/[fileId] - Remove file from project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, fileId } = await params
        console.log(`Attempting to delete file ${fileId} from project ${id}`)

        // 1. Get file metadata to find path
        const { data: file, error: fetchError } = await supabase
            .from('files')
            .select('url, name')
            .eq('id', fileId)
            .eq('project_id', id)
            .single()

        if (fetchError || !file) {
            console.error('Error fetching file for deletion:', fetchError)
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Extract storage path from URL (handles both relative paths and full URLs)
        let storagePath = ''
        if (file.url) {
            try {
                // Try parsing as a full URL first (legacy format)
                const urlObj = new URL(file.url)
                const pathParts = urlObj.pathname.split('/documents/')
                if (pathParts.length > 1) {
                    storagePath = decodeURIComponent(pathParts[1])
                }
            } catch {
                // Not a full URL — it's already a relative storage path
                storagePath = file.url
            }
        }

        if (storagePath) {
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([storagePath])

            if (storageError) {
                console.error('Storage delete error (non-fatal):', storageError)
            }
        }

        // 2. Delete RAG chunks for this file
        await deleteFileChunks(fileId)

        // 3. Delete from Database
        const { error } = await supabase
            .from('files')
            .delete()
            .eq('id', fileId)
            .eq('project_id', id)

        if (error) {
            console.error('Error deleting file record:', error)
            return NextResponse.json({ error: 'Failed to delete file record' }, { status: 500 })
        }

        // 4. Update project file count
        const { error: rpcError } = await supabase.rpc('decrement_file_count', { project_id: id })

        if (rpcError) {
            console.log('RPC failed, using fallback for file count decrement')
            const { data: p } = await supabase.from('projects').select('file_count').eq('id', id).single()
            if (p) {
                await supabase.from('projects').update({ file_count: Math.max(0, (p.file_count || 0) - 1) }).eq('id', id)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in DELETE /api/documents/projects/[id]/files/[fileId]:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
