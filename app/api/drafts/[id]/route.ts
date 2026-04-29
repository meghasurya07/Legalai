import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/drafts/[id] — Fetch a single draft
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id } = await params

    try {
        const { data: draft, error } = await supabase
            .from('drafts')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (error || !draft) {
            return apiError('Draft not found', 404)
        }

        return NextResponse.json({ draft })
    } catch (err) {
        logger.error('drafts', `GET [${id}] error`, err)
        return apiError('Failed to load draft', 500)
    }
}

/**
 * PATCH /api/drafts/[id] — Update draft content (autosave), title, status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id } = await params

    const body = await request.json()

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) updates.content = body.content
    if (body.contentText !== undefined) updates.content_text = body.contentText
    if (body.wordCount !== undefined) updates.word_count = body.wordCount
    if (body.status !== undefined) updates.status = body.status
    if (body.documentType !== undefined) updates.document_type = body.documentType
    if (body.projectId !== undefined) updates.project_id = body.projectId

    try {
        const { data: draft, error } = await supabase
            .from('drafts')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) {
            return apiError(error.message, 500)
        }

        return NextResponse.json({ draft })
    } catch (err) {
        logger.error('drafts', `PATCH [${id}] error`, err)
        return apiError('Failed to update draft', 500)
    }
}

/**
 * DELETE /api/drafts/[id] — Archive (soft-delete) a draft
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id } = await params

    try {
        const { error } = await supabase
            .from('drafts')
            .update({ is_archived: true, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)

        if (error) {
            return apiError(error.message, 500)
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        logger.error('drafts', `DELETE [${id}] error`, err)
        return apiError('Failed to delete draft', 500)
    }
}
