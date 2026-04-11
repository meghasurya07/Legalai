import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export async function GET() {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const [orgs, members, projects, conversations, files] = await Promise.all([
            supabase.from('organizations').select('id', { count: 'exact', head: true }),
            supabase.from('organization_members').select('id', { count: 'exact', head: true }),
            supabase.from('projects').select('id', { count: 'exact', head: true }),
            supabase.from('conversations').select('id', { count: 'exact', head: true }),
            supabase.from('files').select('id', { count: 'exact', head: true }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                organizations: orgs.count || 0,
                users: members.count || 0,
                projects: projects.count || 0,
                conversations: conversations.count || 0,
                files: files.count || 0,
            }
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
