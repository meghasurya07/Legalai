import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/auth/get-user-id'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/documents/projects/[id]/clauses — Search clauses across project documents
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { id } = await params

        // Verify project ownership
        const { data: project, error: projError } = await supabase
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (projError || !project) {
            return apiError('Project not found', 404)
        }

        const { searchParams } = new URL(request.url)
        const clauseType = searchParams.get('type')

        let query = supabase
            .from('document_clauses')
            .select(`
                *,
                files!inner(name)
            `)
            .eq('project_id', id)
            .order('clause_type', { ascending: true })

        if (clauseType) {
            query = query.eq('clause_type', clauseType)
        }

        const { data, error } = await query

        if (error) {
            return apiError('Failed to fetch project clauses', 500, error)
        }

        const clauses = (data || []).map((c: Record<string, unknown>) => {
            const files = c.files as { name: string } | null
            return {
                id: c.id,
                fileId: c.file_id,
                projectId: c.project_id,
                fileName: files?.name || null,
                clauseType: c.clause_type,
                sectionTitle: c.section_title,
                sectionNumber: c.section_number,
                content: c.content,
                chunkRef: c.chunk_ref,
                createdAt: c.created_at
            }
        })

        return NextResponse.json(clauses)
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
