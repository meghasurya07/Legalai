import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/super-admin'

export async function GET() {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        // Recent errors from system_logs
        const { data: recentErrors } = await supabase
            .from('system_logs')
            .select('id, event_type, data, created_at')
            .ilike('event_type', '%error%')
            .order('created_at', { ascending: false })
            .limit(20)

        // Recent jobs
        const { data: recentJobs } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        // DB table sizes
        const tables = ['organizations', 'organization_members', 'projects', 'files', 'file_chunks', 'conversations', 'messages']
        const tableSizes = await Promise.all(
            tables.map(async (table) => {
                const { count } = await supabase
                    .from(table)
                    .select('id', { count: 'exact', head: true })
                return { table, count: count || 0 }
            })
        )

        return NextResponse.json({
            success: true,
            data: {
                recentErrors: recentErrors || [],
                recentJobs: recentJobs || [],
                tableSizes,
            }
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
