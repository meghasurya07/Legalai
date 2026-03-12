import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { getUserId } from '@/lib/get-user-id'
import { canManage } from '@/lib/permissions'

// GET /api/org — Get current organization details
export async function GET() {
    try {
        const ctx = await getOrgContext()

        // If no org context (pre-migration or no org), return a placeholder
        if (!ctx) {
            const userId = await getUserId()
            if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

            // Return a virtual org response so the UI doesn't break
            return NextResponse.json({
                success: true,
                data: {
                    id: null,
                    name: 'My Organization',
                    slug: 'default',
                    status: 'active',
                    member_count: 1,
                    created_at: new Date().toISOString()
                },
                role: 'owner',
                pending_migration: true
            })
        }

        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', ctx.orgId)
            .single()

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                status: data.status,
                member_count: data.member_count,
                created_at: data.created_at
            },
            role: ctx.role
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/org — Update organization (admin+)
export async function PATCH(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Organization not configured yet. Please run migrations first.' }, { status: 400 })

        if (!canManage(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await request.json()
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (body.name) updates.name = body.name.trim()
        if (body.slug) updates.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', ctx.orgId)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Audit log
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'org.updated',
            target_entity: 'organization',
            target_id: ctx.orgId,
            metadata: updates
        })

        return NextResponse.json({ success: true, data })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
