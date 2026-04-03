/**
 * Trust & Insight Layer — Project (Matter) Summary Generator
 * 
 * Builds a holistic overview of the entire project/matter.
 */

import { callAI } from '@/lib/ai/client'
import { AI_TOKENS } from '@/lib/ai/config'
import { supabase } from '@/lib/supabase/server'
import { parseAIJSON } from '@/lib/api-utils'
import { retrieveProjectAnalysis, retrieveClauses } from '@/lib/document-intelligence'
import { logger } from '@/lib/logger'

/**
 * Generate or update the project summary.
 */
export async function generateProjectSummary(projectId: string): Promise<boolean> {
    try {
        logger.info("trust/summary", `[Trust] Generating project summary for ${projectId}`)

        // 1. Gather all intelligence
        const [analyses, clauses, conflictsResult, memoriesResult, entitiesResult] = await Promise.all([
            retrieveProjectAnalysis(projectId),
            retrieveClauses(projectId),
            supabase.from('project_conflicts').select('conflict_type, description, severity').eq('project_id', projectId),
            supabase.from('project_memory').select('content, memory_type').eq('project_id', projectId).limit(15),
            supabase.from('project_entities').select('name, entity_type').eq('project_id', projectId).limit(30)
        ])

        const context = [
            analyses.length > 0 ? `DOCUMENTS:\n${analyses.map(a => a.summary).join('\n')}` : '',
            clauses.length > 0 ? `CLAUSES:\n${clauses.slice(0, 8).map(c => `[${c.clauseType}] ${c.content.slice(0, 200)}`).join('\n')}` : '',
            conflictsResult.data?.length ? `CONFLICTS:\n${conflictsResult.data.map(c => `[${c.severity}] ${c.description}`).join('\n')}` : '',
            memoriesResult.data?.length ? `FACTS:\n${memoriesResult.data.map(m => m.content).join('\n')}` : '',
            entitiesResult.data?.length ? `ENTITIES:\n${entitiesResult.data.map(e => `${e.entity_type}: ${e.name}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n')

        if (context.length < 50) {
            logger.info("trust/summary", '[Trust] Insufficient data for summary generation')
            return false
        }

        // 2. AI summary
        const { result } = await callAI('project_summary', { text: context }, {
            jsonMode: true,
            maxTokens: AI_TOKENS.trust
        })

        const parsed = parseAIJSON(result, undefined)
        if (!parsed?.summary) return false

        const summaryRow = {
            project_id: projectId,
            summary_text: String(parsed.summary || ''),
            key_parties: Array.isArray(parsed.parties) ? parsed.parties : [],
            jurisdiction: parsed.jurisdiction || null,
            risks: Array.isArray(parsed.risks) ? parsed.risks : [],
            obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [],
            conflicts_count: conflictsResult.data?.length || 0,
            updated_at: new Date().toISOString()
        }

        // 3. Upsert (update if exists, insert otherwise)
        const { data: existing } = await supabase
            .from('project_summaries')
            .select('id')
            .eq('project_id', projectId)
            .limit(1)

        if (existing && existing.length > 0) {
            await supabase
                .from('project_summaries')
                .update(summaryRow)
                .eq('project_id', projectId)
        } else {
            await supabase
                .from('project_summaries')
                .insert(summaryRow)
        }

        logger.info("trust/summary", `[Trust] Project summary generated for ${projectId}`)
        return true

    } catch (error) {
        console.error('[Trust] Summary generation failed:', error)
        return false
    }
}

/**
 * Retrieve existing project summary for context injection.
 */
export async function retrieveProjectSummary(projectId: string): Promise<string> {
    const { data, error } = await supabase
        .from('project_summaries')
        .select('*')
        .eq('project_id', projectId)
        .limit(1)
        .single()

    if (error || !data) return ''

    let summary = data.summary_text as string

    const parties = data.key_parties as Array<{ name: string; role: string }>
    if (Array.isArray(parties) && parties.length > 0) {
        summary += `\nParties: ${parties.map(p => `${p.name} (${p.role})`).join(', ')}`
    }

    if (data.jurisdiction) {
        summary += `\nJurisdiction: ${data.jurisdiction}`
    }

    if ((data.conflicts_count as number) > 0) {
        summary += `\nConflicts detected: ${data.conflicts_count}`
    }

    return summary
}
