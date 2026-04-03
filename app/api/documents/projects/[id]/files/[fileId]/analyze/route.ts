import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { callAISafe } from '@/lib/ai/client'
import { getUserId } from '@/lib/get-user-id'
import { checkRateLimit, RATE_LIMIT_HEAVY } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

interface RouteParams {
    params: Promise<{ id: string; fileId: string }>
}

// POST /api/documents/projects/[id]/files/[fileId]/analyze
// Body: { action: 'summarize' | 'analyze', text: string }
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: projectId, fileId } = await params

        // Verify project ownership
        const { data: project, error: projError } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .eq('user_id', userId)
            .single()

        if (projError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        // Rate limit AI-heavy operations
        const { allowed } = checkRateLimit(`analyze:${userId}`, RATE_LIMIT_HEAVY)
        if (!allowed) {
            return NextResponse.json({ error: 'Too many analysis requests. Please slow down.' }, { status: 429 })
        }

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

        // Resolve org context for BYOK
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch (err) { logger.error("analyze/route", "Operation failed", err) }

        const { result, error } = await callAISafe(useCase as 'document_summary' | 'document_analysis', {
            text
        }, { orgId })

        if (error) {
            return NextResponse.json({ error }, { status: 503 })
        }

        logger.info("analyze/route", `[Vault AI] project=${projectId} file=${fileId} action=${action}`)

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
