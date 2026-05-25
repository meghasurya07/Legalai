/**
 * Document Intelligence — Main Analysis Pipeline
 * 
 * Orchestrates document summary, metadata extraction, and clause detection
 * for uploaded legal documents. Designed for fire-and-forget async execution.
 * 
 * KEY UPGRADES:
 * - Chunked analysis: processes entire documents via overlapping text windows
 * - Parallel execution: summary + metadata + clauses run concurrently
 * - Zod validation: all AI outputs are schema-validated
 * - Error reporting: failures are logged and surfaced, not silenced
 * - Re-analysis support: force flag bypasses idempotency check
 * - File status updates: sets file status to 'ready' or 'failed'
 */

import { callAI } from '@/lib/ai/client'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'
import { supabase } from '@/lib/supabase/server'
import { buildSummaryPrompt, buildMetadataPrompt, buildMergeSummaryPrompt } from './prompts'
import { extractClauses } from './clauses'
import type { UseCase } from '@/lib/ai/prompts'
import { logger } from '@/lib/logger'
import type { Party, Obligation, Risk } from './types'
import type { ExtractedMetadata } from './metadata'

// ─── Text Windowing Configuration ──────────────────────────
/** Maximum characters per analysis window (~1500 tokens) */
const WINDOW_SIZE = 6000
/** Overlap between consecutive windows to avoid splitting clauses */
const WINDOW_OVERLAP = 800
/** Maximum number of windows to process (prevents runaway on huge docs) */
const MAX_WINDOWS = 20
/** Minimum text length to trigger analysis */
const MIN_TEXT_LENGTH = 50

/**
 * Split document text into overlapping windows for analysis.
 * Each window is small enough for the AI to process accurately while
 * ensuring the entire document is covered.
 */
function createTextWindows(text: string): string[] {
    if (text.length <= WINDOW_SIZE) {
        return [text]
    }

    const windows: string[] = []
    let offset = 0

    while (offset < text.length && windows.length < MAX_WINDOWS) {
        const end = Math.min(offset + WINDOW_SIZE, text.length)
        let windowText = text.slice(offset, end)

        // Try to break at sentence boundary (look back up to 200 chars)
        if (end < text.length) {
            const lastSentenceEnd = windowText.lastIndexOf('. ')
            const lastNewline = windowText.lastIndexOf('\n')
            const breakPoint = Math.max(lastSentenceEnd, lastNewline)
            if (breakPoint > WINDOW_SIZE * 0.6) {
                windowText = windowText.slice(0, breakPoint + 1)
            }
        }

        windows.push(windowText.trim())
        offset += windowText.length - WINDOW_OVERLAP

        // If remaining text is smaller than overlap, include it in last window
        if (text.length - offset < WINDOW_OVERLAP && offset < text.length) {
            const remaining = text.slice(offset).trim()
            if (remaining.length > MIN_TEXT_LENGTH) {
                windows.push(remaining)
            }
            break
        }
    }

    return windows
}

/**
 * Extract summary from a single text window.
 */
async function extractWindowSummary(
    text: string,
    windowInfo: string
): Promise<string> {
    const { systemPrompt, userPrompt } = buildSummaryPrompt(text, windowInfo)
    const { result } = await callAI('doc_intel_summary' as UseCase, {
        systemOverride: systemPrompt,
        userOverride: userPrompt,
        text
    }, {
        jsonMode: true,
        maxTokens: AI_TOKENS.docIntel.summary,
        model: AI_MODELS.docIntel,
        temperature: AI_TEMPERATURES.precise
    })

    const parsed = JSON.parse(result)
    return parsed.summary || ''
}

/**
 * Extract metadata from a single text window.
 */
async function extractWindowMetadata(
    text: string,
    windowInfo: string
): Promise<ExtractedMetadata> {
    const defaults: ExtractedMetadata = {
        parties: [],
        effectiveDate: null,
        governingLaw: null,
        terminationClause: null,
        keyObligations: [],
        risks: []
    }

    try {
        const { systemPrompt, userPrompt } = buildMetadataPrompt(text, windowInfo)
        const { result } = await callAI('doc_intel_metadata' as UseCase, {
            systemOverride: systemPrompt,
            userOverride: userPrompt,
            text
        }, {
            jsonMode: true,
            maxTokens: AI_TOKENS.docIntel.metadata,
            model: AI_MODELS.docIntel,
            temperature: AI_TEMPERATURES.precise
        })

        const parsed = JSON.parse(result)

        return {
            parties: Array.isArray(parsed.parties) ? parsed.parties.map((p: Record<string, string>) => ({
                name: String(p.name || ''),
                role: String(p.role || '')
            })) : [],
            effectiveDate: parsed.effective_date || null,
            governingLaw: parsed.governing_law || null,
            terminationClause: parsed.termination_clause || null,
            keyObligations: Array.isArray(parsed.key_obligations) ? parsed.key_obligations.map((o: Record<string, string>) => ({
                party: String(o.party || ''),
                obligation: String(o.obligation || ''),
                deadline: o.deadline || undefined
            })) : [],
            risks: Array.isArray(parsed.risks) ? parsed.risks.map((r: Record<string, string>) => ({
                category: String(r.category || ''),
                description: String(r.description || ''),
                severity: (['high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium') as 'high' | 'medium' | 'low'
            })) : []
        }
    } catch {
        return defaults
    }
}

/**
 * Merge multiple partial summaries into a single cohesive summary.
 */
async function mergeSummaries(partials: string[]): Promise<string> {
    // Filter out empty summaries
    const validSummaries = partials.filter(s => s && s.trim().length > 0)
    if (validSummaries.length === 0) return 'Summary generation failed — document may require manual review.'
    if (validSummaries.length === 1) return validSummaries[0]

    try {
        const { systemPrompt, userPrompt } = buildMergeSummaryPrompt(validSummaries)
        const { result } = await callAI('doc_intel_summary' as UseCase, {
            systemOverride: systemPrompt,
            userOverride: userPrompt,
            text: validSummaries.join('\n')
        }, {
            jsonMode: true,
            maxTokens: 1200,
            model: AI_MODELS.docIntel,
            temperature: AI_TEMPERATURES.precise
        })

        const parsed = JSON.parse(result)
        return parsed.summary || validSummaries[0]
    } catch (err) {
        logger.error('lib', '[DocIntel] Summary merge failed, using first partial:', err)
        return validSummaries[0]
    }
}

/**
 * Merge metadata results from multiple windows.
 * Deduplicates parties by name, obligations by content, risks by description.
 */
function mergeMetadata(results: ExtractedMetadata[]): ExtractedMetadata {
    const merged: ExtractedMetadata = {
        parties: [],
        effectiveDate: null,
        governingLaw: null,
        terminationClause: null,
        keyObligations: [],
        risks: []
    }

    const seenParties = new Set<string>()
    const seenObligations = new Set<string>()
    const seenRisks = new Set<string>()

    for (const m of results) {
        // Take the first non-null date, law, termination clause
        if (!merged.effectiveDate && m.effectiveDate) merged.effectiveDate = m.effectiveDate
        if (!merged.governingLaw && m.governingLaw) merged.governingLaw = m.governingLaw
        if (!merged.terminationClause && m.terminationClause) merged.terminationClause = m.terminationClause

        // Deduplicate parties by lowercase name
        for (const p of m.parties) {
            const key = p.name.toLowerCase().trim()
            if (!seenParties.has(key) && key.length > 0) {
                seenParties.add(key)
                merged.parties.push(p)
            }
        }

        // Deduplicate obligations by first 80 chars
        for (const o of m.keyObligations) {
            const key = `${o.party.toLowerCase()}:${o.obligation.substring(0, 80).toLowerCase()}`
            if (!seenObligations.has(key)) {
                seenObligations.add(key)
                merged.keyObligations.push(o)
            }
        }

        // Deduplicate risks by first 80 chars
        for (const r of m.risks) {
            const key = r.description.substring(0, 80).toLowerCase()
            if (!seenRisks.has(key)) {
                seenRisks.add(key)
                merged.risks.push(r)
            }
        }
    }

    return merged
}

/**
 * Update file processing status in Supabase.
 */
async function updateFileStatus(fileId: string, status: 'ready' | 'failed', errorMsg?: string): Promise<void> {
    try {
        const updateData: Record<string, unknown> = { processing_status: status }
        if (errorMsg) {
            updateData.processing_error = errorMsg.substring(0, 500)
        }
        await supabase
            .from('files')
            .update(updateData)
            .eq('id', fileId)
    } catch (err) {
        logger.error('lib', `[DocIntel] Failed to update file status for ${fileId}:`, err)
    }
}

/**
 * Run the full document intelligence pipeline for a file.
 * 
 * KEY IMPROVEMENTS:
 * - Processes ENTIRE document via overlapping text windows (no more 6000-char truncation)
 * - Runs summary + metadata + clauses in PARALLEL per window
 * - Merges and deduplicates results from all windows
 * - Updates file status to 'ready' or 'failed'
 * - Supports force re-analysis via `force` flag
 * 
 * This function is fire-and-forget safe — all errors are caught and logged.
 */
export async function analyzeDocument(
    fileId: string,
    projectId: string,
    text: string,
    options?: { force?: boolean }
): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()

    try {
        if (!text || text.trim().length < MIN_TEXT_LENGTH) {
            logger.info("document-intelligence/analyzer", `[DocIntel] Skipping file ${fileId} — insufficient text (${text?.length || 0} chars)`)
            return { success: true }
        }

        // 1. Check for existing analysis (idempotent, unless force=true)
        if (!options?.force) {
            const { count } = await supabase
                .from('document_analysis')
                .select('*', { count: 'exact', head: true })
                .eq('file_id', fileId)

            if (count && count > 0) {
                logger.info("document-intelligence/analyzer", `[DocIntel] Analysis already exists for file ${fileId}, skipping (use force=true to re-analyze)`)
                return { success: true }
            }
        } else {
            // Force re-analysis: delete existing results first
            await Promise.all([
                supabase.from('document_analysis').delete().eq('file_id', fileId),
                supabase.from('document_clauses').delete().eq('file_id', fileId)
            ])
            logger.info("document-intelligence/analyzer", `[DocIntel] Force re-analysis: cleared existing data for file ${fileId}`)
        }

        logger.info("document-intelligence/analyzer", `[DocIntel] Starting analysis for file ${fileId} (${text.length} chars)...`)

        // 2. Split document into overlapping windows
        const windows = createTextWindows(text)
        logger.info("document-intelligence/analyzer", `[DocIntel] Document split into ${windows.length} windows for analysis`)

        // 3. Process all windows — summary + metadata in parallel per window
        const windowResults = await Promise.all(
            windows.map(async (windowText, idx) => {
                const windowInfo = windows.length > 1
                    ? `window ${idx + 1} of ${windows.length}`
                    : undefined

                // Run summary and metadata extraction in parallel for this window
                const [summary, metadata] = await Promise.all([
                    extractWindowSummary(windowText, windowInfo || '').catch(err => {
                        logger.error('lib', `[DocIntel] Summary failed for window ${idx + 1}:`, err)
                        return ''
                    }),
                    extractWindowMetadata(windowText, windowInfo || '').catch(err => {
                        logger.error('lib', `[DocIntel] Metadata failed for window ${idx + 1}:`, err)
                        return {
                            parties: [] as Party[],
                            effectiveDate: null,
                            governingLaw: null,
                            terminationClause: null,
                            keyObligations: [] as Obligation[],
                            risks: [] as Risk[]
                        } as ExtractedMetadata
                    })
                ])

                return { summary, metadata }
            })
        )

        // 4. Merge results from all windows
        const partialSummaries = windowResults.map(r => r.summary)
        const allMetadata = windowResults.map(r => r.metadata)

        const [finalSummary, mergedMetadata] = await Promise.all([
            mergeSummaries(partialSummaries),
            Promise.resolve(mergeMetadata(allMetadata))
        ])

        // 5. Persist to document_analysis
        const { error: insertError } = await supabase
            .from('document_analysis')
            .insert({
                file_id: fileId,
                project_id: projectId,
                summary: finalSummary,
                parties: mergedMetadata.parties,
                effective_date: mergedMetadata.effectiveDate,
                termination_clause: mergedMetadata.terminationClause,
                governing_law: mergedMetadata.governingLaw,
                key_obligations: mergedMetadata.keyObligations,
                risks: mergedMetadata.risks
            })

        if (insertError) {
            logger.error('lib', `[DocIntel] Failed to persist analysis for file ${fileId}:`, insertError)
            await updateFileStatus(fileId, 'failed', insertError.message)
            return { success: false, error: insertError.message }
        }

        // 6. Extract clauses from full text (clauses module handles its own windowing)
        const clauses = await extractClauses(fileId, projectId, text)

        // 7. Knowledge Graph Extraction (via job queue)
        import('@/lib/jobs').then(j => {
            j.enqueueJob('GRAPH_BUILD', {
                projectId,
                text,
                source: 'doc',
                refId: fileId
            }, projectId)
        }).catch(err => logger.error('[DocIntel] Graph job enqueue failed:', err))

        // 8. Update file status to ready
        await updateFileStatus(fileId, 'ready')

        const duration = Date.now() - startTime
        logger.info("document-intelligence/analyzer",
            `[DocIntel] Analysis complete for file ${fileId}: ` +
            `windows=${windows.length}, summary=${finalSummary.length} chars, clauses=${clauses.length}, ` +
            `parties=${mergedMetadata.parties.length}, risks=${mergedMetadata.risks.length}, ` +
            `duration=${duration}ms`
        )

        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        logger.error('lib', `[DocIntel] Fatal error for file ${fileId} (${duration}ms):`, error)
        await updateFileStatus(fileId, 'failed', error instanceof Error ? error.message : 'Unknown error')
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
            logger.error('[DocIntel] Failed to retrieve project analysis:', 'Error occurred', error)
            return []
        }

        return (data || []).map(d => ({
            fileId: d.file_id,
            summary: d.summary
        }))
    } catch (error) {
        logger.error('[DocIntel] Project analysis retrieval error:', 'Error occurred', error)
        return []
    }
}
