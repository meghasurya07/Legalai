import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/super-admin'

export async function GET(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const rawSearch = request.nextUrl.searchParams.get('search') || ''
        // Escape SQL wildcards to prevent pattern injection
        const search = rawSearch.replace(/%/g, '\\%').replace(/_/g, '\\_')

        let query = supabase
            .from('organizations')
            .select('id, name, slug, status, member_count, created_at, created_by_user_id')
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
                    project_count: projectCount || 0,
                }
            })
        )

        return NextResponse.json({ success: true, data: enriched })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
