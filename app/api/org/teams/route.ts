import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { canManage } from '@/lib/auth/rbac'

// GET /api/org/teams — List teams
export async function GET() {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('org_id', ctx.orgId)
            .order('created_at', { ascending: true })

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/org/teams — Create team (admin+)
export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        if (!canManage(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await request.json()
        const { sanitizeShortText, sanitizeText } = await import('@/lib/validation')
        
        const name = sanitizeShortText(body.name, 100)
        const description = sanitizeText(body.description, 1000)

        if (!name) {
            return NextResponse.json({ success: false, error: 'Valid team name is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('teams')
            .insert({
                org_id: ctx.orgId,
                name,
                description: description || null
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Audit
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'team.created',
            target_entity: 'team',
            target_id: data.id,
            metadata: { name }
        })

        return NextResponse.json({ success: true, data })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/org/teams?id=xxx — Delete team (admin+)
export async function DELETE(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        if (!canManage(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const { validateUUID } = await import('@/lib/validation')
        const id = validateUUID(searchParams.get('id'))

        if (!id) {
            return NextResponse.json({ success: false, error: 'Valid team id is required' }, { status: 400 })
        }

        // Get team name for audit
        const { data: team } = await supabase
            .from('teams')
            .select('name')
            .eq('id', id)
            .eq('org_id', ctx.orgId)
            .single()

        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', id)
            .eq('org_id', ctx.orgId)

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Unassign projects from deleted team
        await supabase
            .from('projects')
            .update({ team_id: null })
            .eq('team_id', id)
            .eq('org_id', ctx.orgId)

        // Audit
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'team.deleted',
            target_entity: 'team',
            target_id: id,
            metadata: { name: team?.name || 'Unknown' }
        })

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
