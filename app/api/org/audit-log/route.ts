import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'

// GET /api/org/audit-log — Paginated audit log
export async function GET(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        const { data, error, count } = await supabase
            .from('audit_log')
            .select('*', { count: 'exact' })
            .eq('org_id', ctx.orgId)
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
