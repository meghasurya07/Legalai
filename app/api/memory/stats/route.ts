import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

/**
 * GET /api/memory/stats — Memory health dashboard data
 * Handles missing table gracefully.
 */
export async function GET(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)
    const userId = session.user.sub

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const emptyStats = {
        stats: {
            total: 0, active: 0, stale: 0, pinned: 0,
            by_type: {}, by_source: {},
        }
    }

    try {
        const filterCol = projectId ? 'project_id' : 'user_id'
        const filterVal = projectId || userId

        const { count: total, error: totalErr } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq(filterCol, filterVal)

        // If table doesn't exist, return empty stats gracefully
        if (totalErr) {
            if (totalErr.message.includes('schema cache') || totalErr.message.includes('memories')) {
                return NextResponse.json(emptyStats)
            }
            return apiError(totalErr.message, 500)
        }

        const { count: active } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq(filterCol, filterVal)
            .eq('is_active', true)

        const { count: stale } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq(filterCol, filterVal)
            .eq('is_active', true)
            .lt('decay_weight', 0.2)
            .eq('reinforcement_count', 0)

        const { count: pinned } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq(filterCol, filterVal)
            .eq('is_pinned', true)
            .eq('is_active', true)

        const { data: typeData } = await supabase
            .from('memories')
            .select('memory_type')
            .eq(filterCol, filterVal)
            .eq('is_active', true)

        const by_type: Record<string, number> = {}
        for (const row of typeData || []) {
            by_type[row.memory_type] = (by_type[row.memory_type] || 0) + 1
        }

        const { data: sourceData } = await supabase
            .from('memories')
            .select('source')
            .eq(filterCol, filterVal)
            .eq('is_active', true)

        const by_source: Record<string, number> = {}
        for (const row of sourceData || []) {
            by_source[row.source] = (by_source[row.source] || 0) + 1
        }

        return NextResponse.json({
            stats: {
                total: total || 0,
                active: active || 0,
                stale: stale || 0,
                pinned: pinned || 0,
                by_type,
                by_source,
            }
        })
    } catch (err) {
        console.error('[Memory Stats] Error:', err)
        return NextResponse.json(emptyStats)
    }
}
