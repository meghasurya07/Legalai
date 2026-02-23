/**
 * Trust & Insight Layer — Vault Auto-Insights
 * 
 * Aggregates project-level risks, obligations, and patterns
 * into actionable legal insights.
 */

import { callAI } from '@/lib/ai/client'
import { supabase } from '@/lib/supabase/server'
import { parseAIJSON } from '@/lib/api-utils'
import { retrieveProjectAnalysis, retrieveClauses } from '@/lib/document-intelligence'
import type { InsightType, Severity } from './types'

/**
 * Generate auto-insights for a project's vault.
 */
export async function generateVaultInsights(projectId: string): Promise<number> {
    try {
        console.log(`[Trust] Generating vault insights for project ${projectId}`)

        // 1. Skip if recently generated
        const { count: existing } = await supabase
            .from('project_insights')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)

        if (existing && existing > 0) {
            console.log(`[Trust] Insights already exist (${existing}), skipping`)
            return existing
        }

        // 2. Gather intelligence
        const [analyses, clauses, conflictsResult, memoriesResult] = await Promise.all([
            retrieveProjectAnalysis(projectId),
            retrieveClauses(projectId),
            supabase.from('project_conflicts').select('description, severity').eq('project_id', projectId).limit(10),
            supabase.from('project_memory').select('content, memory_type').eq('project_id', projectId).limit(20)
        ])

        const context = [
            analyses.length > 0 ? `DOCUMENT SUMMARIES:\n${analyses.map(a => a.summary).join('\n')}` : '',
            clauses.length > 0 ? `KEY CLAUSES:\n${clauses.slice(0, 10).map(c => `[${c.clauseType}] ${c.content.slice(0, 200)}`).join('\n')}` : '',
            conflictsResult.data?.length ? `CONFLICTS:\n${conflictsResult.data.map(c => c.description).join('\n')}` : '',
            memoriesResult.data?.length ? `PROJECT FACTS:\n${memoriesResult.data.map(m => `[${m.memory_type}] ${m.content}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n')

        if (context.length < 50) {
            console.log('[Trust] Insufficient data for insight generation')
            return 0
        }

        // 3. AI insight generation
        const { result } = await callAI('vault_insights', { text: context }, {
            jsonMode: true,
            maxTokens: 1500
        })

        const parsed = parseAIJSON(result, undefined)
        const insights = Array.isArray(parsed?.insights) ? parsed.insights : []

        // 4. Persist
        let count = 0
        for (const insight of insights) {
            const { error } = await supabase
                .from('project_insights')
                .insert({
                    project_id: projectId,
                    insight_type: (insight.type || 'other') as InsightType,
                    description: String(insight.description || ''),
                    severity: (['high', 'medium', 'low'].includes(insight.severity) ? insight.severity : 'medium') as Severity,
                    related_entity_ids: insight.entity_ids || []
                })

            if (!error) count++
        }

        console.log(`[Trust] Generated ${count} insights for project ${projectId}`)
        return count

    } catch (error) {
        console.error('[Trust] Insight generation failed:', error)
        return 0
    }
}

/**
 * Retrieve existing insights for context injection.
 */
export async function retrieveInsights(projectId: string): Promise<string> {
    const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('project_id', projectId)
        .order('severity', { ascending: true })
        .limit(8)

    if (error || !data || data.length === 0) return ''

    return data.map(i =>
        `- [${(i.severity as string).toUpperCase()}] ${i.insight_type}: ${i.description}`
    ).join('\n')
}
