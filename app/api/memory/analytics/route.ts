import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getTopClausePatterns } from '@/lib/memory/clause-intelligence'

/**
 * GET /api/memory/analytics — Cross-case analytics queries
 *
 * Query params:
 *   - type: 'arguments' | 'clauses' | 'risks' | 'patterns'
 *   - clauseType: filter by clause type (for clauses query)
 *   - jurisdiction: filter by jurisdiction
 *   - limit: max results (default 20)
 */
export async function GET(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'arguments'
    const clauseType = searchParams.get('clauseType') || undefined
    const jurisdiction = searchParams.get('jurisdiction') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get org from user metadata
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', session.user.sub)
        .single()

    const organizationId = profile?.organization_id as string
    if (!organizationId) return apiError('Organization not found', 404)

    switch (type) {
        case 'arguments':
            return getArgumentAnalytics(organizationId, jurisdiction, limit)
        case 'clauses':
            return getClauseAnalytics(organizationId, clauseType, jurisdiction, limit)
        case 'risks':
            return getRiskAnalytics(organizationId, limit)
        case 'patterns':
            return getPatternAnalytics(organizationId, limit)
        default:
            return apiError('Invalid analytics type', 400)
    }
}

/**
 * Argument success analytics across cases.
 */
async function getArgumentAnalytics(
    organizationId: string,
    jurisdiction: string | undefined,
    limit: number
) {
    let query = supabase
        .from('arguments')
        .select('argument_type, strength, outcome, jurisdiction, ruling_summary, metadata')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (jurisdiction) {
        query = query.eq('jurisdiction', jurisdiction)
    }

    const { data, error } = await query

    if (error) return apiError('Failed to fetch arguments', 500)

    // Aggregate success rates by argument type
    const typeStats: Record<string, { total: number; won: number; lost: number }> = {}

    for (const arg of data || []) {
        const t = (arg.argument_type as string) || 'unknown'
        if (!typeStats[t]) typeStats[t] = { total: 0, won: 0, lost: 0 }
        typeStats[t].total++
        if (arg.outcome === 'won' || arg.outcome === 'accepted') typeStats[t].won++
        if (arg.outcome === 'lost' || arg.outcome === 'rejected') typeStats[t].lost++
    }

    const successRates = Object.entries(typeStats).map(([type, stats]) => ({
        argumentType: type,
        total: stats.total,
        won: stats.won,
        lost: stats.lost,
        successRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
    }))

    return NextResponse.json({
        type: 'arguments',
        totalArguments: data?.length || 0,
        successRates,
        recentArguments: (data || []).slice(0, 10),
    })
}

/**
 * Clause pattern analytics.
 */
async function getClauseAnalytics(
    organizationId: string,
    clauseType: string | undefined,
    jurisdiction: string | undefined,
    limit: number
) {
    const patterns = await getTopClausePatterns({
        organizationId,
        clauseType,
        jurisdiction,
        minFrequency: 1,
        limit,
    })

    // Group by clause type
    const typeGroups: Record<string, { count: number; totalFrequency: number }> = {}
    for (const p of patterns) {
        if (!typeGroups[p.clause_type]) {
            typeGroups[p.clause_type] = { count: 0, totalFrequency: 0 }
        }
        typeGroups[p.clause_type].count++
        typeGroups[p.clause_type].totalFrequency += p.frequency
    }

    return NextResponse.json({
        type: 'clauses',
        totalPatterns: patterns.length,
        topPatterns: patterns.slice(0, 10),
        byType: Object.entries(typeGroups).map(([type, stats]) => ({
            clauseType: type,
            uniqueVariations: stats.count,
            totalUsage: stats.totalFrequency,
        })),
    })
}

/**
 * Risk distribution analytics.
 */
async function getRiskAnalytics(organizationId: string, limit: number) {
    const { data } = await supabase
        .from('memories')
        .select('content, importance, confidence, project_id, metadata')
        .eq('organization_id', organizationId)
        .eq('memory_type', 'risk')
        .eq('is_active', true)
        .order('importance', { ascending: false })
        .limit(limit)

    const riskByImportance = {
        critical: (data || []).filter(r => (r.importance as number) >= 5).length,
        high: (data || []).filter(r => (r.importance as number) === 4).length,
        medium: (data || []).filter(r => (r.importance as number) === 3).length,
        low: (data || []).filter(r => (r.importance as number) <= 2).length,
    }

    return NextResponse.json({
        type: 'risks',
        totalRisks: data?.length || 0,
        distribution: riskByImportance,
        topRisks: (data || []).slice(0, 10).map(r => ({
            content: r.content,
            importance: r.importance,
            confidence: r.confidence,
        })),
    })
}

/**
 * Firm-level pattern analytics.
 */
async function getPatternAnalytics(organizationId: string, limit: number) {
    const { data } = await supabase
        .from('firm_patterns')
        .select('pattern_type, description, confidence, sample_size, last_computed_at')
        .eq('organization_id', organizationId)
        .gte('sample_size', 2)
        .order('confidence', { ascending: false })
        .limit(limit)

    const byType: Record<string, number> = {}
    for (const p of data || []) {
        const t = p.pattern_type as string
        byType[t] = (byType[t] || 0) + 1
    }

    return NextResponse.json({
        type: 'patterns',
        totalPatterns: data?.length || 0,
        byType,
        patterns: data || [],
    })
}
