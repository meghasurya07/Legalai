import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/super-admin'

const PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.150, output: 0.600 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'o4-mini': { input: 1.10, output: 4.40 },
    'o4-mini-deep-research': { input: 1.10, output: 4.40 },
    'text-embedding-3-small': { input: 0.02, output: 0.00 }, // Output is typically 0 for embeddings
    'default': { input: 0.150, output: 0.600 }
}

function calculateCost(model: string, tIn: number, tOut: number) {
    const rates = PRICING[model] || PRICING['default']
    return (tIn / 1_000_000) * rates.input + (tOut / 1_000_000) * rates.output
}

export async function GET() {
    const admin = await requireSuperAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        // Fetch all AI_CALL logs with their data
        const { data: aiLogs } = await supabase
            .from('system_logs')
            .select('data, user_id, org_id, created_at')
            .eq('event_type', 'AI_CALL')
            .order('created_at', { ascending: false })

        const logs = aiLogs || []

        // Aggregate totals
        const totalCalls = logs.length
        let totalTokensIn = 0
        let totalTokensOut = 0
        let totalTokens = 0
        let totalLatency = 0
        let totalCost = 0

        // Per-user breakdown
        const perUser: Record<string, { calls: number; tokensIn: number; tokensOut: number; tokens: number; cost: number }> = {}
        // Per-org breakdown
        const perOrg: Record<string, { calls: number; tokensIn: number; tokensOut: number; tokens: number; cost: number }> = {}
        // Per-model breakdown
        const perModel: Record<string, { calls: number; tokens: number; cost: number }> = {}
        // Per-useCase breakdown
        const perUseCase: Record<string, { calls: number; tokens: number; cost: number }> = {}
        // Daily breakdown (last 30 days)
        const perDay: Record<string, { calls: number; tokens: number; cost: number }> = {}

        for (const log of logs) {
            const d = log.data as Record<string, number | string | boolean> || {}
            let tIn = Number(d.tokensIn) || 0
            let tOut = Number(d.tokensOut) || 0
            // For streaming calls where token counts aren't captured, estimate from charCount
            // Rough heuristic: ~4 chars per token for English text
            if (tIn === 0 && tOut === 0 && Number(d.charCount) > 0) {
                tOut = Math.ceil(Number(d.charCount) / 4)
                tIn = Math.ceil(tOut * 2) // Assume input is ~2x output for chat
            }
            const tTotal = Number(d.tokensTotal) || (tIn + tOut)
            const lat = Number(d.latencyMs) || 0
            const model = String(d.model || 'gpt-4o-mini')
            const cost = calculateCost(model, tIn, tOut)

            totalTokensIn += tIn
            totalTokensOut += tOut
            totalTokens += tTotal
            totalLatency += lat
            totalCost += cost

            // Per user
            const uid = log.user_id || 'unknown'
            if (!perUser[uid]) perUser[uid] = { calls: 0, tokensIn: 0, tokensOut: 0, tokens: 0, cost: 0 }
            perUser[uid].calls++
            perUser[uid].tokensIn += tIn
            perUser[uid].tokensOut += tOut
            perUser[uid].tokens += tTotal
            perUser[uid].cost += cost

            // Per org
            const oid = log.org_id || 'unassigned'
            if (!perOrg[oid]) perOrg[oid] = { calls: 0, tokensIn: 0, tokensOut: 0, tokens: 0, cost: 0 }
            perOrg[oid].calls++
            perOrg[oid].tokensIn += tIn
            perOrg[oid].tokensOut += tOut
            perOrg[oid].tokens += tTotal
            perOrg[oid].cost += cost

            // Per model
            if (!perModel[model]) perModel[model] = { calls: 0, tokens: 0, cost: 0 }
            perModel[model].calls++
            perModel[model].tokens += tTotal
            perModel[model].cost += cost

            // Per use case
            const uc = String(d.useCase || 'unknown')
            if (!perUseCase[uc]) perUseCase[uc] = { calls: 0, tokens: 0, cost: 0 }
            perUseCase[uc].calls++
            perUseCase[uc].tokens += tTotal
            perUseCase[uc].cost += cost

            // Per day
            const day = log.created_at?.slice(0, 10) || 'unknown'
            if (!perDay[day]) perDay[day] = { calls: 0, tokens: 0, cost: 0 }
            perDay[day].calls++
            perDay[day].tokens += tTotal
            perDay[day].cost += cost
        }

        // Get user names — check user_settings first, then org_members
        const userIds = Object.keys(perUser).filter(id => id !== 'unknown')
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('user_id, user_name')
            .in('user_id', userIds)

        const userNameMap: Record<string, string> = {}
        for (const s of userSettings || []) {
            if (s.user_name) userNameMap[s.user_id] = s.user_name
        }

        // For any IDs still unresolved, check organization_members
        const unresolvedIds = userIds.filter(id => !userNameMap[id])
        if (unresolvedIds.length > 0) {
            const { data: members } = await supabase
                .from('organization_members')
                .select('user_id, user_name')
                .in('user_id', unresolvedIds)
            for (const m of members || []) {
                if (m.user_name) userNameMap[m.user_id] = m.user_name
            }
        }

        // Get org names for per-org breakdown
        const orgIds = Object.keys(perOrg).filter(id => id !== 'unassigned')
        const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name')
            .in('id', orgIds)

        const orgNameMap: Record<string, string> = {}
        for (const o of orgs || []) {
            orgNameMap[o.id] = o.name
        }

        // Format per-user array sorted by tokens desc
        const perUserArray = Object.entries(perUser)
            .map(([id, stats]) => ({
                userId: id,
                name: id === 'unknown'
                    ? 'System (automated)'
                    : userNameMap[id] || (id.startsWith('auth0|') ? 'You' : id.slice(0, 20)),
                ...stats
            }))
            .sort((a, b) => b.tokens - a.tokens)

        // Format per-org array sorted by tokens desc
        const perOrgArray = Object.entries(perOrg)
            .map(([id, stats]) => ({
                orgId: id,
                name: id === 'unassigned'
                    ? 'Personal (no org)'
                    : orgNameMap[id] || id.slice(0, 20),
                ...stats
            }))
            .sort((a, b) => b.tokens - a.tokens)

        // Format per-model array
        const perModelArray = Object.entries(perModel)
            .map(([model, stats]) => ({ model, ...stats }))
            .sort((a, b) => b.tokens - a.tokens)

        // Format per-useCase array
        const perUseCaseArray = Object.entries(perUseCase)
            .map(([useCase, stats]) => ({ useCase, ...stats }))
            .sort((a, b) => b.tokens - a.tokens)

        // Format daily array (sorted by date)
        const dailyArray = Object.entries(perDay)
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30) // Last 30 days

        return NextResponse.json({
            success: true,
            data: {
                totals: {
                    calls: totalCalls,
                    tokensIn: totalTokensIn,
                    tokensOut: totalTokensOut,
                    tokens: totalTokens,
                    avgLatency: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
                    cost: totalCost,
                },
                perUser: perUserArray,
                perOrg: perOrgArray,
                perModel: perModelArray,
                perUseCase: perUseCaseArray,
                daily: dailyArray,
            }
        })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
