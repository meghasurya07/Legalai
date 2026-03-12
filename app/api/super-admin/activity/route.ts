import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/super-admin'

export async function GET() {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { data, error } = await supabase
            .from('system_logs')
            .select('id, event_type, project_id, ref_id, data, created_at, org_id')
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
