import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'

// GET /api/org/audit-log/export — CSV export of audit log (same filters as main route)
export async function GET(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const action = searchParams.get('action')
        const userId = searchParams.get('userId')
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        const search = searchParams.get('search')

        let query = supabase
            .from('audit_log')
            .select('*')
            .eq('org_id', ctx.orgId)

        if (action) {
            if (action.includes('.')) {
                query = query.eq('action', action)
            } else {
                query = query.like('action', `${action}.%`)
            }
        }
        if (userId) query = query.eq('actor_user_id', userId)
        if (from) query = query.gte('created_at', from)
        if (to) {
            const toDate = new Date(to)
            toDate.setDate(toDate.getDate() + 1)
            query = query.lt('created_at', toDate.toISOString())
        }
        if (search) {
            query = query.or(`action.ilike.%${search}%,target_entity.ilike.%${search}%,actor_name.ilike.%${search}%`)
        }

        // Fetch up to 10,000 records for export
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(10000)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Build CSV
        const headers = ['Timestamp', 'User', 'User ID', 'Action', 'Target Type', 'Target ID', 'Details']
        const rows = (data || []).map(entry => [
            new Date(entry.created_at).toISOString(),
            csvEscape(entry.actor_name || ''),
            csvEscape(entry.actor_user_id),
            csvEscape(entry.action),
            csvEscape(entry.target_entity),
            csvEscape(entry.target_id || ''),
            csvEscape(entry.metadata ? JSON.stringify(entry.metadata) : '')
        ].join(','))

        const csv = [headers.join(','), ...rows].join('\n')

        const filename = `audit_log_${new Date().toISOString().split('T')[0]}.csv`

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            }
        })
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}
