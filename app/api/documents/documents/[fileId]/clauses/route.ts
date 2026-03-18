import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/get-user-id'

interface RouteParams {
    params: Promise<{ fileId: string }>
}

// GET /api/documents/documents/[fileId]/clauses — Get document clauses
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { fileId } = await params
        const { searchParams } = new URL(request.url)
        const clauseType = searchParams.get('type')

        // Verify ownership: file → project → user
        const { data: file, error: fileError } = await supabase
            .from('files')
            .select('id, projects!inner(user_id)')
            .eq('id', fileId)
            .single()

        if (fileError || !file) {
            return apiError('Document not found', 404)
        }

        const project = file.projects as unknown as { user_id: string }
        if (project.user_id !== userId) {
            return apiError('Document not found', 404)
        }

        let query = supabase
            .from('document_clauses')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        if (clauseType) {
            query = query.eq('clause_type', clauseType)
        }

        const { data, error } = await query

        if (error) {
            return apiError('Failed to fetch clauses', 500, error)
        }

        const clauses = (data || []).map(c => ({
            id: c.id,
            fileId: c.file_id,
            projectId: c.project_id,
            clauseType: c.clause_type,
            sectionTitle: c.section_title,
            sectionNumber: c.section_number,
            content: c.content,
            chunkRef: c.chunk_ref,
            createdAt: c.created_at
        }))

        return NextResponse.json(clauses)
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
