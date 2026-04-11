import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { getManagementApiToken, getManagementApiBaseUrl } from '@/lib/auth/management-api'

// Resolve an email address to an Auth0 user_id (sub) via Management API
async function resolveEmailToUserId(email: string): Promise<string | null> {
    try {
        const token = await getManagementApiToken()
        const baseUrl = getManagementApiBaseUrl()
        const res = await fetch(
            `${baseUrl}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
        )
        if (!res.ok) return null
        const users = await res.json()
        return users?.[0]?.user_id || null
    } catch {
        console.error('[resolveEmailToUserId] Failed to resolve email:', email)
        return null
    }
}

export async function GET(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const rawSearch = request.nextUrl.searchParams.get('search') || ''
        const search = rawSearch.replace(/%/g, '\\%').replace(/_/g, '\\_')

        let query = supabase
            .from('organizations')
            .select('id, name, slug, status, member_count, licensed_seats, sso_domain, created_at, created_by_user_id')
            .order('created_at', { ascending: false })
            .limit(100)

        if (search) {
            query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
        }

        const { data, error } = await query

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // Enrich with project counts
        const enriched = await Promise.all(
            (data || []).map(async (org) => {
                const { count: projectCount } = await supabase
                    .from('projects')
                    .select('id', { count: 'exact', head: true })
                    .eq('org_id', org.id)

                return {
                    ...org,
                    licensed_seats: org.licensed_seats ?? 10,
                    project_count: projectCount || 0,
                }
            })
        )

        return NextResponse.json({ success: true, data: enriched })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/super-admin/organizations — Create a new organization
export async function POST(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()

        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const slug = typeof body.slug === 'string'
            ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
            : ''
        const licensedSeats = typeof body.licensed_seats === 'number' && body.licensed_seats > 0
            ? body.licensed_seats
            : 10
        const ssoDomain = typeof body.sso_domain === 'string' ? body.sso_domain.trim().toLowerCase() : null
        const status = body.status === 'suspended' ? 'suspended' : 'active'

        if (!name || name.length < 2) {
            return NextResponse.json({ success: false, error: 'Organization name is required (min 2 characters)' }, { status: 400 })
        }

        if (!slug || slug.length < 2) {
            return NextResponse.json({ success: false, error: 'A valid slug is required (min 2 characters, lowercase, alphanumeric)' }, { status: 400 })
        }

        // Check slug uniqueness
        const { data: existing } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .single()

        if (existing) {
            return NextResponse.json({ success: false, error: 'An organization with this slug already exists' }, { status: 409 })
        }

        const { data, error } = await supabase
            .from('organizations')
            .insert({
                name,
                slug,
                licensed_seats: licensedSeats,
                sso_domain: ssoDomain || null,
                status,
                created_by_user_id: admin.userId,
                member_count: 0,
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        // If owner_email is provided, assign them as the org owner
        let ownerAssigned = false
        let ownerWarning: string | null = null
        const ownerEmail = typeof body.owner_email === 'string' ? body.owner_email.trim().toLowerCase() : ''

        if (ownerEmail) {
            const ownerUserId = await resolveEmailToUserId(ownerEmail)
            if (ownerUserId) {
                // Insert as org owner in organization_members
                await supabase.from('organization_members').insert({
                    org_id: data.id,
                    organization_id: data.id,
                    user_id: ownerUserId,
                    role: 'owner',
                    user_name: ownerEmail,
                })

                // Set this org as their default
                await supabase.from('user_settings').upsert({
                    user_id: ownerUserId,
                    default_org_id: data.id,
                })

                // Update member_count
                await supabase.from('organizations').update({ member_count: 1 }).eq('id', data.id)

                ownerAssigned = true
            } else {
                ownerWarning = `No Auth0 account found for "${ownerEmail}". The org was created but has no owner yet. The user must sign up first, then you can add them manually.`
            }
        }

        return NextResponse.json({ success: true, data, ownerAssigned, ownerWarning })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/super-admin/organizations — Update an organization
export async function PATCH(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const id = typeof body.id === 'string' ? body.id.trim() : ''

        if (!id) {
            return NextResponse.json({ success: false, error: 'Organization id is required' }, { status: 400 })
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (typeof body.name === 'string' && body.name.trim().length >= 2) {
            updates.name = body.name.trim()
        }
        if (typeof body.licensed_seats === 'number' && body.licensed_seats > 0) {
            updates.licensed_seats = body.licensed_seats
        }
        if (typeof body.sso_domain === 'string') {
            updates.sso_domain = body.sso_domain.trim().toLowerCase() || null
        }
        if (body.status === 'active' || body.status === 'suspended') {
            updates.status = body.status
        }

        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
