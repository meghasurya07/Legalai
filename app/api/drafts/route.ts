import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

/**
 * GET /api/drafts — List user's drafts
 */
export async function GET(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const documentType = searchParams.get('documentType')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    try {
        let query = supabase
            .from('drafts')
            .select('id, user_id, org_id, project_id, title, document_type, word_count, status, is_archived, created_at, updated_at', { count: 'exact' })
            .eq('user_id', userId)
            .eq('is_archived', false)

        if (projectId) query = query.eq('project_id', projectId)
        if (status) query = query.eq('status', status)
        if (documentType) query = query.eq('document_type', documentType)
        if (search) query = query.ilike('title', `%${search}%`)

        query = query.order('updated_at', { ascending: false })

        const offset = (page - 1) * limit
        query = query.range(offset, offset + limit - 1)

        const { data: drafts, count, error } = await query

        if (error) {
            if (error.message.includes('schema cache') || error.message.includes('drafts')) {
                return NextResponse.json({ drafts: [], total: 0, page, limit, totalPages: 0 })
            }
            return apiError(error.message, 500)
        }

        return NextResponse.json({
            drafts: drafts || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        })
    } catch (err) {
        logger.error('drafts', 'GET error', err)
        return apiError('Failed to load drafts', 500)
    }
}

/**
 * POST /api/drafts — Create a new draft
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth

    let orgId = '00000000-0000-0000-0000-000000000001'
    try {
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('default_org_id')
            .eq('user_id', userId)
            .single()
        if (userSettings?.default_org_id) orgId = userSettings.default_org_id
    } catch { /* user_settings might not exist */ }

    const body = await request.json()
    const title = body.title || 'Untitled Document'
    const content = body.content || [{ type: 'p', children: [{ text: '' }] }]
    const contentText = body.contentText || ''
    const documentType = body.documentType || 'general'
    const projectId = body.projectId || null
    const wordCount = body.wordCount || 0

    try {
        const { data: draft, error } = await supabase
            .from('drafts')
            .insert({
                user_id: userId,
                org_id: orgId,
                project_id: projectId,
                title,
                content,
                content_text: contentText,
                document_type: documentType,
                word_count: wordCount,
                status: 'draft',
                is_archived: false,
            })
            .select()
            .single()

        if (error) {
            if (error.message.includes('schema cache') || error.message.includes('drafts')) {
                return apiError('Drafts table not found. Please run the drafts migration.', 500)
            }
            return apiError(error.message, 500)
        }

        return NextResponse.json({ draft }, { status: 201 })
    } catch (err) {
        logger.error('drafts', 'POST error', err)
        return apiError('Failed to create draft', 500)
    }
}
