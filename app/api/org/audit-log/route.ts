import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'

// GET /api/org/audit-log — Filterable, paginated audit log
export async function GET(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        // Only admins/owners can view audit logs
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const offset = parseInt(searchParams.get('offset') || '0')
        const action = searchParams.get('action')
        const userId = searchParams.get('userId')
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        const search = searchParams.get('search')

        let query = supabase
            .from('audit_log')
            .select('*', { count: 'exact' })
            .eq('org_id', ctx.orgId)

        // Filter by action type (supports prefix matching: "ethical_wall" matches "ethical_wall.created", etc.)
        if (action) {
            if (action.includes('.')) {
                query = query.eq('action', action)
            } else {
                query = query.like('action', `${action}.%`)
            }
        }

        // Filter by actor
        if (userId) {
            query = query.eq('actor_user_id', userId)
        }

        // Date range
        if (from) {
            query = query.gte('created_at', from)
        }
        if (to) {
            // Add 1 day to make the 'to' date inclusive
            const toDate = new Date(to)
            toDate.setDate(toDate.getDate() + 1)
            query = query.lt('created_at', toDate.toISOString())
        }

        // Text search across action, target_entity, actor_name
        if (search) {
            query = query.or(`action.ilike.%${search}%,target_entity.ilike.%${search}%,actor_name.ilike.%${search}%`)
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            data: data || [],
            total: count || 0,
            limit,
            offset
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
