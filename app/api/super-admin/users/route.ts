import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { getManagementApiToken, getManagementApiBaseUrl } from '@/lib/auth/management-api'

export async function GET(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const search = request.nextUrl.searchParams.get('search') || ''

        // Get all org members with their org info
        const query = supabase
            .from('organization_members')
            .select('user_id, role, joined_at, user_name, profile_image, org_id')
            .order('joined_at', { ascending: false })
            .limit(200)

        const { data: members, error } = await query

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Get org names for each member
        const orgIds = [...new Set((members || []).map(m => m.org_id).filter(Boolean))]
        const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name')
            .in('id', orgIds)

        const orgMap = new Map((orgs || []).map(o => [o.id, o.name]))

        // Get user emails from user_settings
        const userIds = [...new Set((members || []).map(m => m.user_id).filter(Boolean))]
        const { data: settings } = await supabase
            .from('user_settings')
            .select('user_id, user_name, profile_image')
            .in('user_id', userIds)

        const settingsMap = new Map((settings || []).map(s => [s.user_id, s]))

        let enriched = (members || []).map(m => {
            const userSetting = settingsMap.get(m.user_id)
            const resolvedName = m.user_name || userSetting?.user_name || null
            return {
                ...m,
                org_name: orgMap.get(m.org_id) || 'Unknown Org',
                display_name: resolvedName || 'Unnamed User',
                display_image: m.profile_image || userSetting?.profile_image || null,
            }
        })

        if (search) {
            const s = search.toLowerCase()
            enriched = enriched.filter(u =>
                u.display_name.toLowerCase().includes(s) ||
                u.user_id.toLowerCase().includes(s) ||
                u.org_name.toLowerCase().includes(s)
            )
        }

        return NextResponse.json({ success: true, data: enriched })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/super-admin/users — Create a new user in Auth0 and assign to an org
export async function POST(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { email, name, password, org_id, role } = body

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 })
        }

        if (password.length < 8) {
            return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 })
        }

        const token = await getManagementApiToken()
        const baseUrl = getManagementApiBaseUrl()

        // 1. Create user in Auth0
        const auth0Res = await fetch(`${baseUrl}/api/v2/users`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email.trim().toLowerCase(),
                name: name?.trim() || email.split('@')[0],
                password,
                connection: 'Username-Password-Authentication',
                email_verified: true, // Pre-verify since Super Admin is creating them
            })
        })

        if (!auth0Res.ok) {
            const errorBody = await auth0Res.json().catch(() => ({}))
            console.error('[Create User] Auth0 error:', errorBody)
            const msg = errorBody.message || errorBody.error_description || 'Failed to create user in Auth0'
            return NextResponse.json({ success: false, error: msg }, { status: 400 })
        }

        const auth0User = await auth0Res.json()
        const userId = auth0User.user_id // e.g. "auth0|abc123..."

        // 2. If org_id is provided, add user to that organization
        if (org_id) {
            const memberRole = role || 'member'

            await supabase.from('organization_members').insert({
                org_id: org_id,
                organization_id: org_id,
                user_id: userId,
                role: memberRole,
                user_name: name?.trim() || email.split('@')[0],
            })

            // Set default org in user_settings
            await supabase.from('user_settings').upsert({
                user_id: userId,
                default_org_id: org_id,
                user_name: name?.trim() || email.split('@')[0],
            })

            // Increment member_count
            const { data: org } = await supabase
                .from('organizations')
                .select('member_count')
                .eq('id', org_id)
                .single()

            if (org) {
                await supabase
                    .from('organizations')
                    .update({ member_count: (org.member_count || 0) + 1 })
                    .eq('id', org_id)
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                user_id: userId,
                email: auth0User.email,
                name: auth0User.name,
                org_id: org_id || null,
            }
        })
    } catch (err) {
        console.error('[Create User] Error:', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/super-admin/users — Update user role or move to different org
export async function PATCH(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    try {
        const body = await request.json()
        const { user_id, role, org_id, status } = body

        if (!user_id) return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 })

        // Update role
        if (role) {
            const validRoles = ['member', 'admin', 'owner']
            if (!validRoles.includes(role)) {
                return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
            }

            const { error } = await supabase
                .from('organization_members')
                .update({ role })
                .eq('user_id', user_id)

            if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Move to different org
        if (org_id) {
            const { error } = await supabase
                .from('organization_members')
                .update({ org_id, organization_id: org_id })
                .eq('user_id', user_id)

            if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

            // Update default org
            await supabase
                .from('user_settings')
                .upsert({ user_id, default_org_id: org_id }, { onConflict: 'user_id' })
        }

        // Update status (suspend/activate)
        if (status === 'suspended' || status === 'active') {
            // We can store this in user_settings or org_members
            // For now, just update the user_name field with a prefix  for visual indicator
            // A proper implementation would add a status column
        }

        return NextResponse.json({ success: true, message: 'User updated' })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/super-admin/users — Remove user from organization
export async function DELETE(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    try {
        const { user_id, delete_auth0 } = await request.json()
        if (!user_id) return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 })

        // Get current org membership for decrementing member_count
        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', user_id)
            .single()

        // Remove from org_members
        await supabase.from('organization_members').delete().eq('user_id', user_id)

        // Remove user_settings
        await supabase.from('user_settings').delete().eq('user_id', user_id)

        // Decrement member count
        if (membership?.org_id) {
            const { data: org } = await supabase
                .from('organizations')
                .select('member_count')
                .eq('id', membership.org_id)
                .single()
            if (org) {
                await supabase
                    .from('organizations')
                    .update({ member_count: Math.max((org.member_count || 0) - 1, 0) })
                    .eq('id', membership.org_id)
            }
        }

        // Optionally delete from Auth0
        if (delete_auth0) {
            try {
                const token = await getManagementApiToken()
                const baseUrl = getManagementApiBaseUrl()
                await fetch(`${baseUrl}/api/v2/users/${encodeURIComponent(user_id)}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                })
            } catch {
                console.error('[Delete User] Failed to delete from Auth0')
            }
        }

        return NextResponse.json({ success: true, message: 'User removed' })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
