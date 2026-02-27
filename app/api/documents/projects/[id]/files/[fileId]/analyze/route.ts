import { NextRequest, NextResponse } from 'next/server'
import { callAISafe } from '@/lib/ai/client'

interface RouteParams {
    params: Promise<{ id: string; fileId: string }>
}

// POST /api/documents/projects/[id]/files/[fileId]/analyze
// Body: { action: 'summarize' | 'analyze', text: string }
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id: projectId, fileId } = await params
        const { action, text } = await request.json()

        if (!action || !text) {
            return NextResponse.json(
                { error: 'Action and text are required' },
                { status: 400 }
            )
        }

        if (action !== 'summarize' && action !== 'analyze') {
            return NextResponse.json(
                { error: 'Action must be "summarize" or "analyze"' },
                { status: 400 }
            )
        }

        const useCase = action === 'summarize' ? 'document_summary' : 'document_analysis'

        const { result, error } = await callAISafe(useCase as 'document_summary' | 'document_analysis', {
            text
        })

        if (error) {
            return NextResponse.json({ error }, { status: 503 })
        }

        // Optionally store the analysis result linked to the file
        // (Using a simple approach — store in file metadata or a new table)
        console.log(`[Vault AI] project=${projectId} file=${fileId} action=${action}`)

        return NextResponse.json({
            fileId,
            action,
            result
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to analyze document'
        console.error('Document analysis error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
