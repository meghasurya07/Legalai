import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getOrgContext } from '@/lib/get-org-context'
import { getUserId } from '@/lib/auth/get-user-id'
import { getBlockedProjectIds } from '@/lib/ethical-walls'

// GET /api/documents/projects - List all projects for the current user/org
export async function GET() {
    try {
        const ctx = await getOrgContext()
        const userId = ctx?.userId || await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        let query = supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        // Add org_id filter only if org context is available (post-migration)
        if (ctx?.orgId) {
            query = query.eq('org_id', ctx.orgId)

            // Ethical Wall enforcement: exclude blocked projects
            const blockedIds = await getBlockedProjectIds(ctx.orgId, userId)
            if (blockedIds.length > 0) {
                query = query.not('id', 'in', `(${blockedIds.join(',')})`)
            }
        }

        const { data, error } = await query

        if (error) {
            return apiError('Failed to fetch projects', 500, error)
        }

        // Transform to match frontend interface
        const projects = data.map(p => ({
            id: p.id,
            title: p.title,
            organization: p.organization,
            fileCount: p.file_count,
            queryCount: p.query_count,
            isSecured: p.is_secured,
            icon: p.icon,
            files: [] // Files loaded separately
        }))

        return NextResponse.json(projects)
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// POST /api/documents/projects - Create a new project
export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        const userId = ctx?.userId || await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const body = await request.json()
        const { sanitizeShortText } = await import('@/lib/validation')
        const title = sanitizeShortText(body.title, 200)

        if (!title) {
            return NextResponse.json({ error: 'Valid title is required' }, { status: 400 })
        }

        const insertData: Record<string, unknown> = { title: title.trim(), user_id: userId }
        // Only include org_id if org context is available (post-migration)
        if (ctx?.orgId) {
            insertData.org_id = ctx.orgId
        }

        const { data, error } = await supabase
            .from('projects')
            .insert(insertData)
            .select()
            .single()

        if (error) {
            return apiError('Failed to create project', 500, error)
        }

        // Transform to match frontend interface
        const project = {
            id: data.id,
            title: data.title,
            organization: data.organization,
            fileCount: data.file_count,
            queryCount: data.query_count,
            isSecured: data.is_secured,
            icon: data.icon,
            files: []
        }

        return NextResponse.json(project, { status: 201 })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
