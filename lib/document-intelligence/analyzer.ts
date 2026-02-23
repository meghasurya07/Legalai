/**
 * Document Intelligence — Main Analysis Pipeline
 * 
 * Orchestrates document summary, metadata extraction, and clause detection
 * for uploaded legal documents. Designed for fire-and-forget async execution.
 */

import { callAI } from '@/lib/ai/client'
import { supabase } from '@/lib/supabase/server'
import { buildSummaryPrompt } from './prompts'
import { extractMetadata } from './metadata'
import { extractClauses } from './clauses'
import type { UseCase } from '@/lib/ai/prompts'

/**
 * Run the full document intelligence pipeline for a file.
 * 
 * Steps:
 * 1. Check if analysis already exists (idempotent)
 * 2. Generate document summary
 * 3. Extract structured metadata
 * 4. Persist analysis to document_analysis table
 * 5. Extract and store clauses
 * 
 * This function is fire-and-forget safe — all errors are caught and logged.
 */
export async function analyzeDocument(
    fileId: string,
    projectId: string,
    text: string
): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()

    try {
        if (!text || text.trim().length < 50) {
            console.log(`[DocIntel] Skipping file ${fileId} — insufficient text (${text?.length || 0} chars)`)
            return { success: true }
        }

        // 1. Check for existing analysis (idempotent)
        const { count } = await supabase
            .from('document_analysis')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', fileId)

        if (count && count > 0) {
            console.log(`[DocIntel] Analysis already exists for file ${fileId}, skipping`)
            return { success: true }
        }

        console.log(`[DocIntel] Starting analysis for file ${fileId}...`)

        // 2. Generate summary
        let summary = ''
        try {
            const { systemPrompt, userPrompt } = buildSummaryPrompt(text)
            const { result } = await callAI('doc_intel_summary' as UseCase, {
                systemOverride: systemPrompt,
                userOverride: userPrompt,
                text
            }, {
                jsonMode: true,
                maxTokens: 800,
                model: 'gpt-4o-mini'
            })

            const parsed = JSON.parse(result)
            summary = parsed.summary || result
        } catch (err) {
            console.error(`[DocIntel] Summary generation failed for file ${fileId}:`, err)
            summary = 'Summary generation failed — document may require manual review.'
        }

        // 3. Extract metadata
        const metadata = await extractMetadata(text)

        // 4. Persist to document_analysis
        const { error: insertError } = await supabase
            .from('document_analysis')
            .insert({
                file_id: fileId,
                project_id: projectId,
                summary,
                parties: metadata.parties,
                effective_date: metadata.effectiveDate,
                termination_clause: metadata.terminationClause,
                governing_law: metadata.governingLaw,
                key_obligations: metadata.keyObligations,
                risks: metadata.risks
            })

        if (insertError) {
            console.error(`[DocIntel] Failed to persist analysis for file ${fileId}:`, insertError)
            return { success: false, error: insertError.message }
        }

        // 5. Extract and store clauses (parallel to analysis persistence)
        const clauses = await extractClauses(fileId, projectId, text)

        // 6. Knowledge Graph Extraction (via job queue)
        import('@/lib/jobs').then(j => {
            j.enqueueJob('GRAPH_BUILD', {
                projectId,
                text,
                source: 'doc',
                refId: fileId
            }, projectId)
        }).catch(err => console.error('[DocIntel] Graph job enqueue failed:', err))

        const duration = Date.now() - startTime
        console.log(
            `[DocIntel] Analysis complete for file ${fileId}: ` +
            `summary=${summary.length} chars, clauses=${clauses.length}, ` +
            `parties=${metadata.parties.length}, risks=${metadata.risks.length}, ` +
            `duration=${duration}ms`
        )

        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        console.error(`[DocIntel] Fatal error for file ${fileId} (${duration}ms):`, error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Retrieve all document analysis summaries for a project.
 */
export async function retrieveProjectAnalysis(projectId: string): Promise<Array<{ fileId: string; summary: string }>> {
    try {
        const { data, error } = await supabase
            .from('document_analysis')
            .select('file_id, summary')
            .eq('project_id', projectId)

        if (error) {
            console.error('[DocIntel] Failed to retrieve project analysis:', error)
            return []
        }

        return (data || []).map(d => ({
            fileId: d.file_id,
            summary: d.summary
        }))
    } catch (error) {
        console.error('[DocIntel] Project analysis retrieval error:', error)
        return []
    }
}

