import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

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

        // Dynamically get ALL public tables and their row counts
        const allTables = [
            'organizations', 'organization_members', 'organization_settings', 'organization_invites', 'organization_domains',
            'user_settings', 'projects', 'files', 'file_chunks',
            'conversations', 'messages', 'recent_chats',
            'document_analysis', 'document_clauses', 'document_versions', 'document_suggestions',
            'templates', 'workflow_runs', 'workflow_steps',
            'memories', 'project_memory', 'project_entities', 'project_relationships', 'project_conflicts', 'project_insights', 'project_summaries',
            'jobs', 'system_logs', 'audit_log', 'audit_logs',
            'tabular_review_columns', 'tabular_review_cells', 'tabular_review_messages',
            'matters', 'matter_members',
            'teams', 'team_members',
            'ethical_walls', 'ethical_wall_members', 'ethical_wall_projects',
            'leads', 'prompt_library',
        ]

        const tableSizes = await Promise.all(
            allTables.map(async (table) => {
                try {
                    const { count } = await supabase
                        .from(table)
                        .select('*', { count: 'exact', head: true })
                    return { table, count: count || 0 }
                } catch {
                    return { table, count: -1 } // -1 = table might not exist
                }
            })
        )

        // Filter out tables that errored (don't exist)
        const validTables = tableSizes.filter(t => t.count >= 0).sort((a, b) => b.count - a.count)

        return NextResponse.json({
            success: true,
            data: {
                recentErrors: recentErrors || [],
                recentJobs: recentJobs || [],
                tableSizes: validTables,
                totalTables: validTables.length,
                totalRows: validTables.reduce((sum, t) => sum + t.count, 0),
            }
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
