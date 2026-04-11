import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/auth/get-user-id'

interface RouteParams {
    params: Promise<{ fileId: string }>
}

// GET /api/documents/documents/[fileId] - Get document content for viewer
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { fileId } = await params

        // Verify ownership: file → project → user
        const { data: file, error } = await supabase
            .from('files')
            .select('id, name, type, size, url, project_id, extracted_text, status, uploaded_at, projects!inner(user_id)')
            .eq('id', fileId)
            .single()

        if (error || !file) {
            return apiError('Document not found', 404, error)
        }

        // Check that the project belongs to this user
        const project = file.projects as unknown as { user_id: string }
        if (project.user_id !== userId) {
            return apiError('Document not found', 404)
        }

        // Generate signed URL for the document
        const { data: signedUrl, error: urlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(file.url, 3600)

        if (urlError) {
            console.error('Failed to generate signed URL for document:', urlError)
        }

        // Fetch analysis and clauses
        const { data: analysis } = await supabase
            .from('document_analysis')
            .select('*')
            .eq('file_id', fileId)
            .single()

        const { data: clauses } = await supabase
            .from('document_clauses')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        return NextResponse.json({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            url: signedUrl?.signedUrl || file.url,
            projectId: file.project_id,
            status: file.status,
            uploadedAt: file.uploaded_at,
            content: file.extracted_text || '',
            analysis: analysis || null,
            clauses: clauses || []
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
