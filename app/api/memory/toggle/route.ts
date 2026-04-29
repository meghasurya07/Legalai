import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

/**
 * PATCH /api/memory/toggle — Toggle AI memory persistence on/off (user level)
 * Body: { enabled: boolean }
 * 
 * Stores the preference in user_settings.ai_memory_persistence.
 * Falls back gracefully if the column hasn't been added yet.
 */
export async function PATCH(request: NextRequest) {
    const auth = await requireAuth()

    if (auth instanceof Response) return auth

    const { userId } = auth
const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
        return apiError('enabled must be a boolean', 400)
    }

    // Check org-level override first
    let orgId = '00000000-0000-0000-0000-000000000001'
    try {
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('default_org_id')
            .eq('user_id', userId)
            .single()
        if (userSettings?.default_org_id) orgId = userSettings.default_org_id
    } catch {
        // user_settings row might not exist yet
    }

    try {
        const { data: orgSettings } = await supabase
            .from('organization_settings')
            .select('ai_memory_persistence')
            .eq('organization_id', orgId)
            .single()

        if (orgSettings && orgSettings.ai_memory_persistence === false && enabled) {
            return apiError('Memory has been disabled by your organization administrator. Contact your firm admin to re-enable.', 403)
        }
    } catch {
        // org settings might not have the column yet
    }

    // Try to update user_settings with the toggle
    // If the column doesn't exist yet, we handle gracefully
    try {
        const { error } = await supabase
            .from('user_settings')
            .upsert(
                {
                    user_id: userId,
                    ai_memory_persistence: enabled,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            )

        if (error) {
            // Column might not exist yet — check for schema cache error
            if (error.message.includes('ai_memory_persistence') || error.message.includes('schema cache')) {
                logger.warn("api", "[Memory Toggle] Column ai_memory_persistence not found in user_settings. Run migration 020_add_user_memory_toggle.sql")
                // Still return success — the preference won't persist but the UI should work
                return NextResponse.json({
                    success: true,
                    ai_memory_persistence: enabled,
                    message: enabled
                        ? 'Memory is now enabled (note: run migration to persist this setting).'
                        : 'Memory is now disabled (note: run migration to persist this setting).',
                    warning: 'Database migration needed: run 020_add_user_memory_toggle.sql',
                })
            }
            return apiError('Failed to update setting', 500)
        }
    } catch (err) {
        logger.error('Memory Toggle] Unexpected error:', 'Error', err)
        return apiError('Failed to update setting', 500)
    }

    return NextResponse.json({
        success: true,
        ai_memory_persistence: enabled,
        message: enabled
            ? 'Memory is now enabled. Wesley will learn from your conversations.'
            : 'Memory is now disabled. No new memories will be created.',
    })
}

/**
 * GET /api/memory/toggle — Get current memory toggle state
 * Also returns org-level override status.
 */
export async function GET() {
    const auth = await requireAuth()

    if (auth instanceof Response) return auth

    const { userId } = auth
// Get user-level setting
    let userMemoryEnabled = true
    let orgId = '00000000-0000-0000-0000-000000000001'

    try {
        const { data: userData } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (userData) {
            if (userData.default_org_id) orgId = userData.default_org_id
            // Only override if the column exists and has a value
            if (typeof userData.ai_memory_persistence === 'boolean') {
                userMemoryEnabled = userData.ai_memory_persistence
            }
        }
    } catch {
        // user_settings row might not exist
    }

    // Get org-level setting
    let orgMemoryEnabled = true
    try {
        const { data: orgSettings } = await supabase
            .from('organization_settings')
            .select('ai_memory_persistence')
            .eq('organization_id', orgId)
            .single()

        if (orgSettings && typeof orgSettings.ai_memory_persistence === 'boolean') {
            orgMemoryEnabled = orgSettings.ai_memory_persistence
        }
    } catch {
        // org settings might not exist
    }

    return NextResponse.json({
        enabled: orgMemoryEnabled ? userMemoryEnabled : false,
        userEnabled: userMemoryEnabled,
        orgEnabled: orgMemoryEnabled,
        orgDisabled: !orgMemoryEnabled,
    })
}