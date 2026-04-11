import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

/**
 * GET /api/super-admin/audit-log — Combined audit trail from audit_log + system_logs
 */
export async function GET(request: NextRequest) {
    const admin = await requireSuperAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    try {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const search = searchParams.get('search') || ''
        const source = searchParams.get('source') || 'all' // 'audit' | 'system' | 'all'
        const offset = (page - 1) * limit

        const entries: Array<{
            id: string
            source: string
            action: string
            actor: string
            target: string
            details: Record<string, unknown>
            created_at: string
            org_id: string | null
        }> = []

        // Audit log entries
        if (source === 'all' || source === 'audit') {
            let auditQuery = supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit * 2)

            if (search) auditQuery = auditQuery.ilike('action', `%${search}%`)

            const { data: audits } = await auditQuery
            for (const a of audits || []) {
                entries.push({
                    id: a.id,
                    source: 'audit',
                    action: a.action,
                    actor: a.actor_user_id || 'system',
                    target: a.target_entity || '',
                    details: a.metadata || {},
                    created_at: a.created_at,
                    org_id: a.organization_id || null,
                })
            }
        }

        // System log entries
        if (source === 'all' || source === 'system') {
            let sysQuery = supabase
                .from('system_logs')
                .select('id, event_type, data, user_id, org_id, project_id, created_at')
                .order('created_at', { ascending: false })
                .limit(limit * 2)

            if (search) sysQuery = sysQuery.ilike('event_type', `%${search}%`)

            const { data: sysLogs } = await sysQuery
            for (const s of sysLogs || []) {
                entries.push({
                    id: s.id,
                    source: 'system',
                    action: s.event_type,
                    actor: s.user_id || 'system',
                    target: s.project_id || '',
                    details: (s.data as Record<string, unknown>) || {},
                    created_at: s.created_at,
                    org_id: s.org_id || null,
                })
            }
        }

        // Sort combined entries by date desc
        entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        // Paginate
        const paginated = entries.slice(offset, offset + limit)
        const total = entries.length

        // Resolve user names
        const actorIds = [...new Set(paginated.map(e => e.actor).filter(a => a !== 'system'))]
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('user_id, user_name')
            .in('user_id', actorIds)
        const nameMap = new Map((userSettings || []).map(s => [s.user_id, s.user_name]))

        const enriched = paginated.map(e => ({
            ...e,
            actor_name: nameMap.get(e.actor) || (e.actor === 'system' ? 'System' : e.actor.slice(0, 20)),
        }))

        return NextResponse.json({
            success: true,
            data: enriched,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
