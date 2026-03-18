import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { canManage } from '@/lib/permissions'

// GET /api/org/invites — List pending invitations
export async function GET() {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        const { data, error } = await supabase
            .from('organization_invites')
            .select('*')
            .eq('org_id', ctx.orgId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/org/invites — Create invitation (admin+)
export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        if (!canManage(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await request.json()
        const { isValidEmail, validateEnum } = await import('@/lib/validation')
        
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        const role = validateEnum(body.role || 'member', ['admin', 'member'] as const) || 'member'

        if (!isValidEmail(email)) {
            return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 })
        }

        // Check if already a member
        const { data: existing } = await supabase
            .from('organization_members')
            .select('id')
            .eq('org_id', ctx.orgId)
            .eq('user_id', email)
            .single()

        if (existing) {
            return NextResponse.json({ success: false, error: 'User is already a member' }, { status: 409 })
        }

        // Check for existing pending invite
        const { data: existingInvite } = await supabase
            .from('organization_invites')
            .select('id')
            .eq('org_id', ctx.orgId)
            .eq('email', email.toLowerCase())
            .eq('status', 'pending')
            .single()

        if (existingInvite) {
            return NextResponse.json({ success: false, error: 'Invitation already pending for this email' }, { status: 409 })
        }

        const { data, error } = await supabase
            .from('organization_invites')
            .insert({
                org_id: ctx.orgId,
                email: email.toLowerCase(),
                role,
                invited_by_user_id: ctx.userId
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
            action: 'invite.created',
            target_entity: 'invite',
            target_id: data.id,
            metadata: { email, role }
        })

        return NextResponse.json({ success: true, data })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/org/invites?id=xxx — Revoke invitation (admin+)
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
            return NextResponse.json({ success: false, error: 'Valid invite id is required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('organization_invites')
            .update({ status: 'revoked' })
            .eq('id', id)
            .eq('org_id', ctx.orgId)

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Audit
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'invite.revoked',
            target_entity: 'invite',
            target_id: id,
            metadata: {}
        })

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
