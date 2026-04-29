import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getOrgContext } from '@/lib/get-org-context'
import { requireAuth } from '@/lib/auth/require-auth'
import { isProjectBlocked } from '@/lib/ethical-walls'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/documents/projects/[id] - Get single project with files
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getOrgContext()
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params

        let query = supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)

        if (ctx?.orgId) {
            query = query.eq('org_id', ctx.orgId)
        }

        const { data: project, error: projectError } = await query.single()

        if (projectError || !project) {
            return apiError('Project not found', 404, projectError)
        }

        // Ethical Wall enforcement
        if (ctx?.orgId && await isProjectBlocked(ctx.orgId, userId, id)) {
            return apiError('Access denied: this project is behind an information barrier', 403)
        }

        const { data: files, error: filesError } = await supabase
            .from('files')
            .select('*')
            .eq('project_id', id)
            .order('uploaded_at', { ascending: false })

        if (filesError) {
            logger.error("api", "Error fetching files:", filesError)
        }

        // Generate signed URLs for all files (only if there are files)
        const filePaths = (files || []).map(f => f.url)
        let signedUrls: { signedUrl: string }[] | null = null

        if (filePaths.length > 0) {
            const { data, error: signedError } = await supabase.storage
                .from('documents')
                .createSignedUrls(filePaths, 3600)

            if (signedError) {
                logger.error("api", "Failed to generate signed URLs for project:", signedError)
            }
            signedUrls = data
        }

        return NextResponse.json({
            id: project.id,
            title: project.title,
            organization: project.organization,
            fileCount: project.file_count,
            queryCount: project.query_count,
            isSecured: project.is_secured,
            icon: project.icon,
            files: (files || []).map((f, index) => ({
                id: f.id,
                name: f.name,
                size: f.size,
                type: f.type,
                url: signedUrls?.[index]?.signedUrl || f.url,
                uploadedAt: f.uploaded_at,
                extracted_text: f.extracted_text || null,
                status: f.status
            }))
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// PATCH /api/documents/projects/[id] - Update project (rename, increment query count)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getOrgContext()
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params

        // Ethical Wall enforcement
        if (ctx?.orgId && await isProjectBlocked(ctx.orgId, userId, id)) {
            return apiError('Access denied: this project is behind an information barrier', 403)
        }

        const body = await request.json()
        const { sanitizeShortText } = await import('@/lib/validation')
        const { incrementQueryCount } = body
        const title = body.title === undefined ? undefined : (body.title ? sanitizeShortText(body.title, 200) : null)

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (title !== undefined) {
            updates.title = title
        }

        if (incrementQueryCount) {
            let query = supabase
                .from('projects')
                .select('query_count')
                .eq('id', id)
                .eq('user_id', userId)

            if (ctx?.orgId) query = query.eq('org_id', ctx.orgId)

            const { data: current } = await query.single()

            if (current) {
                updates.query_count = (current.query_count || 0) + 1
            }
        }

        let updateQuery = supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)

        if (ctx?.orgId) updateQuery = updateQuery.eq('org_id', ctx.orgId)

        const { data, error } = await updateQuery.select().single()

        if (error) {
            return apiError('Failed to update project', 500, error)
        }

        return NextResponse.json({
            id: data.id,
            title: data.title,
            organization: data.organization,
            fileCount: data.file_count,
            queryCount: data.query_count,
            isSecured: data.is_secured,
            icon: data.icon
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// DELETE /api/documents/projects/[id] - Delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getOrgContext()
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params

        // Ethical Wall enforcement
        if (ctx?.orgId && await isProjectBlocked(ctx.orgId, userId, id)) {
            return apiError('Access denied: this project is behind an information barrier', 403)
        }

        let query = supabase
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (ctx?.orgId) query = query.eq('org_id', ctx.orgId)

        const { error } = await query

        if (error) {
            return apiError('Failed to delete project', 500, error)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}