import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { isFirmAdmin as checkFirmAdmin } from '@/lib/auth/get-user-role'

/**
 * GET /api/memory/toggle/org — Get org-level memory toggle state
 */
export async function GET() {
    const auth = await requireAuth()

    if (auth instanceof Response) return auth

    const { userId } = auth

    const { data: userData } = await supabase
        .from('user_settings')
        .select('default_org_id')
        .eq('user_id', userId)
        .single()

    const orgId = userData?.default_org_id || '00000000-0000-0000-0000-000000000001'

    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('ai_memory_persistence')
        .eq('organization_id', orgId)
        .single()

    return NextResponse.json({
        enabled: orgSettings?.ai_memory_persistence ?? true,
        organizationId: orgId,
    })
}

/**
 * PATCH /api/memory/toggle/org — Toggle org-level memory on/off (admin only)
 * Body: { enabled: boolean }
 */
export async function PATCH(request: NextRequest) {
    const auth = await requireAuth()

    if (auth instanceof Response) return auth

    const { userId } = auth

    // Verify FIRM_ADMIN role
    const adminByRole = await checkFirmAdmin()

    if (!adminByRole) {
        // Also check org membership role
        const { data: userData } = await supabase
            .from('user_settings')
            .select('default_org_id')
            .eq('user_id', userId)
            .single()

        const orgId = userData?.default_org_id || '00000000-0000-0000-0000-000000000001'

        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return apiError('Only organization admins can change this setting', 403)
        }
    }

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
        return apiError('enabled must be a boolean', 400)
    }

    // Get org ID
    const { data: userData } = await supabase
        .from('user_settings')
        .select('default_org_id')
        .eq('user_id', userId)
        .single()

    const orgId = userData?.default_org_id || '00000000-0000-0000-0000-000000000001'

    const { error } = await supabase
        .from('organization_settings')
        .upsert(
            {
                organization_id: orgId,
                ai_memory_persistence: enabled,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'organization_id' }
        )

    if (error) {
        logger.error('Org Memory Toggle] Failed:', 'Error', error.message)
        return apiError('Failed to update organization setting', 500)
    }

    // Audit log
    try {
        await supabase.from('audit_log').insert({
            organization_id: orgId,
            action: enabled ? 'memory.org_enabled' : 'memory.org_disabled',
            actor_user_id: userId,
            target_entity: 'organization_settings',
            target_id: orgId,
            metadata: { ai_memory_persistence: enabled },
        })
    } catch {
        // Non-critical
    }

    return NextResponse.json({
        success: true,
        enabled,
        message: enabled
            ? 'Memory is now enabled organization-wide.'
            : 'Memory is now disabled organization-wide. No users in this organization can create new memories.',
    })
}