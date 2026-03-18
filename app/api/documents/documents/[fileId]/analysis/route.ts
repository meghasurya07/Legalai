import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/get-user-id'

interface RouteParams {
    params: Promise<{ fileId: string }>
}

// GET /api/documents/documents/[fileId]/analysis — Get document analysis
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { fileId } = await params

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

        const { data, error } = await supabase
            .from('document_analysis')
            .select('*')
            .eq('file_id', fileId)
            .single()

        if (error || !data) {
            return apiError('Analysis not found — document may still be processing', 404, error)
        }

        return NextResponse.json({
            id: data.id,
            fileId: data.file_id,
            projectId: data.project_id,
            summary: data.summary,
            parties: data.parties,
            effectiveDate: data.effective_date,
            terminationClause: data.termination_clause,
            governingLaw: data.governing_law,
            keyObligations: data.key_obligations,
            risks: data.risks,
            createdAt: data.created_at
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
