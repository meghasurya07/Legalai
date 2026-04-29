import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/drafts/[id]/versions — List version history
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id } = await params

    try {
        // Verify ownership
        const { data: draft } = await supabase
            .from('drafts')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (!draft) return apiError('Draft not found', 404)

        const { data: versions, error } = await supabase
            .from('draft_versions')
            .select('id, draft_id, word_count, version_number, change_summary, created_by, created_at')
            .eq('draft_id', id)
            .order('version_number', { ascending: false })
            .limit(50)

        if (error) {
            if (error.message.includes('schema cache') || error.message.includes('draft_versions')) {
                return NextResponse.json({ versions: [] })
            }
            return apiError(error.message, 500)
        }

        return NextResponse.json({ versions: versions || [] })
    } catch (err) {
        logger.error('drafts', `GET versions [${id}] error`, err)
        return apiError('Failed to load versions', 500)
    }
}

/**
 * POST /api/drafts/[id]/versions — Create a version snapshot
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id } = await params

    try {
        // Fetch current draft
        const { data: draft, error: draftError } = await supabase
            .from('drafts')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (draftError || !draft) return apiError('Draft not found', 404)

        const body = await request.json().catch(() => ({}))
        const changeSummary = body.changeSummary || 'Manual save'

        // Get next version number
        const { data: latestVersion } = await supabase
            .from('draft_versions')
            .select('version_number')
            .eq('draft_id', id)
            .order('version_number', { ascending: false })
            .limit(1)
            .single()

        const nextVersion = (latestVersion?.version_number || 0) + 1

        const { data: version, error } = await supabase
            .from('draft_versions')
            .insert({
                draft_id: id,
                content: draft.content,
                content_text: draft.content_text || '',
                word_count: draft.word_count || 0,
                version_number: nextVersion,
                change_summary: changeSummary,
                created_by: userId,
            })
            .select()
            .single()

        if (error) {
            return apiError(error.message, 500)
        }

        return NextResponse.json({ version }, { status: 201 })
    } catch (err) {
        logger.error('drafts', `POST version [${id}] error`, err)
        return apiError('Failed to create version', 500)
    }
}
