import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ fileId: string }>
}

// GET /api/documents/documents/[fileId]/analysis — Get document analysis
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { fileId } = await params

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
