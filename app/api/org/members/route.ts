import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { canManage, outranks } from '@/lib/auth/rbac'
import { requireAuth } from '@/lib/auth/require-auth'

// GET /api/org/members — List org members
export async function GET() {
    try {
        const ctx = await getOrgContext()
        // Pre-migration: return empty members list
        if (!ctx) return NextResponse.json({ success: true, data: [] })

        const { data, error } = await supabase
            .from('organization_members')
            .select('*')
            .eq('org_id', ctx.orgId)
            .order('joined_at', { ascending: true })

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Sync current user's profile from user_settings (Wesley profile) or Auth0
        const auth = await requireAuth()
        if (!(auth instanceof Response) && data) {
            const currentMember = data.find(m => m.user_id === auth.userId)
            
            if (currentMember) {
                // Fetch the user's explicit Wesley settings
                const { data: userSettings } = await supabase
                    .from('user_settings')
                    .select('user_name, profile_image')
                    .eq('user_id', auth.userId)
                    .single();

                const bestName = userSettings?.user_name || auth.userName;
                const bestImage = userSettings?.profile_image;

                // If DB lacks the best name/image or it's different
                if (bestName && (currentMember.user_name !== bestName || currentMember.profile_image !== bestImage)) {
                    
                    // Update DB without awaiting (fire and forget for performance)
                    supabase
                        .from('organization_members')
                        .update({
                            user_name: bestName,
                            profile_image: bestImage
                        })
                        .eq('org_id', ctx.orgId)
                        .eq('user_id', auth.userId)
                        .then(({ error }) => {
                            if (error) logger.error("members", "Failed to sync profile", error);
                        });
                    
                    // Update the returned data immediately for the UI
                    currentMember.user_name = bestName;
                    currentMember.profile_image = bestImage;
                }
            }
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/org/members — Change a member's role (admin+)
export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        if (!canManage(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await request.json()
        const { validateEnum } = await import('@/lib/validation')
        
        const user_id = typeof body.user_id === 'string' ? body.user_id : ''
        const role = validateEnum(body.role, ['admin', 'member'] as const)

        if (!user_id || !role) {
            return NextResponse.json({ success: false, error: 'Valid user_id and role are required' }, { status: 400 })
        }

        // Cannot change owner role
        const { data: target } = await supabase
            .from('organization_members')
            .select('role')
            .eq('org_id', ctx.orgId)
            .eq('user_id', user_id)
            .single()

        if (!target) {
            return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
        }

        if (target.role === 'owner') {
            return NextResponse.json({ success: false, error: 'Cannot change owner role' }, { status: 403 })
        }

        // Actor must outrank the target
        if (!outranks(ctx.role, target.role)) {
            return NextResponse.json({ success: false, error: 'Cannot modify a member with equal or higher role' }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('organization_members')
            .update({ role })
            .eq('org_id', ctx.orgId)
            .eq('user_id', user_id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Audit log
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'member.role_changed',
            target_entity: 'member',
            target_id: user_id,
            metadata: { old_role: target.role, new_role: role }
        })

        return NextResponse.json({ success: true, data })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/org/members?user_id=xxx — Remove a member (admin+)
export async function DELETE(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        if (!canManage(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const targetUserId = searchParams.get('user_id')
        if (!targetUserId || typeof targetUserId !== 'string') {
            return NextResponse.json({ success: false, error: 'Valid user_id is required' }, { status: 400 })
        }

        // Cannot remove owner
        const { data: target } = await supabase
            .from('organization_members')
            .select('role')
            .eq('org_id', ctx.orgId)
            .eq('user_id', targetUserId)
            .single()

        if (!target) {
            return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
        }

        if (target.role === 'owner') {
            return NextResponse.json({ success: false, error: 'Cannot remove the owner' }, { status: 403 })
        }

        if (!outranks(ctx.role, target.role)) {
            return NextResponse.json({ success: false, error: 'Cannot remove a member with equal or higher role' }, { status: 403 })
        }

        const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('org_id', ctx.orgId)
            .eq('user_id', targetUserId)

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Decrement member count
        await supabase.rpc('decrement_member_count', { target_org_id: ctx.orgId }).then(() => {})

        // Audit
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'member.removed',
            target_entity: 'member',
            target_id: targetUserId,
            metadata: { role: target.role }
        })

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}