import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/super-admin'

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
            return {
                ...m,
                org_name: orgMap.get(m.org_id) || 'Unknown',
                display_name: m.user_name || userSetting?.user_name || m.user_id,
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
