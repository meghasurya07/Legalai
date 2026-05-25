/**
 * Document Intelligence — Clause Extraction Engine
 * 
 * Detects, classifies, and stores legal clauses from document text.
 * 
 * KEY UPGRADES:
 * - Windowed extraction: processes full document via text windows
 * - Improved deduplication: uses normalized content comparison
 * - chunkRef: links clauses to approximate document positions
 * - Temperature 0.1: more deterministic JSON extraction
 */

import { callAI } from '@/lib/ai/client'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'
import { supabase } from '@/lib/supabase/server'
import { buildClausePrompt } from './prompts'
import { ClausesResponseSchema } from './schemas'
import type { DocumentClause, ClauseType } from './types'
import { logger } from '@/lib/logger'

const VALID_CLAUSE_TYPES: ClauseType[] = [
    'termination', 'indemnity', 'confidentiality', 'liability',
    'jurisdiction', 'payment', 'intellectual_property', 'dispute_resolution',
    'force_majeure', 'non_compete', 'warranty', 'other'
]

/** Maximum characters per clause extraction window */
const CLAUSE_WINDOW_SIZE = 6000
/** Overlap between clause windows */
const CLAUSE_WINDOW_OVERLAP = 600
/** Maximum windows for clause extraction */
const MAX_CLAUSE_WINDOWS = 20

/**
 * Extract clauses from a single text window.
 */
async function extractClausesFromWindow(
    text: string,
    windowInfo?: string,
    windowIndex?: number
): Promise<Array<{ clauseType: ClauseType; sectionTitle: string | null; sectionNumber: string | null; content: string; chunkRef: string | null }>> {
    try {
        const { systemPrompt, userPrompt } = buildClausePrompt(text, windowInfo)

        const { result } = await callAI('doc_intel_clauses' as import('@/lib/ai/prompts').UseCase, {
            systemOverride: systemPrompt,
            userOverride: userPrompt,
            text
        }, {
            jsonMode: true,
            maxTokens: AI_TOKENS.docIntel.clauses,
            model: AI_MODELS.docIntel,
            temperature: AI_TEMPERATURES.precise
        })

        const parsed = JSON.parse(result)

        // H14: Zod schema validation with graceful fallback
        const zodResult = ClausesResponseSchema.safeParse(parsed)
        let rawClauses: Record<string, string>[]
        if (zodResult.success) {
            rawClauses = zodResult.data.clauses as unknown as Record<string, string>[]
        } else {
            logger.warn('doc-intel/clauses', 'Zod validation failed, using raw parsed', zodResult.error.issues)
            rawClauses = Array.isArray(parsed.clauses) ? parsed.clauses : []
        }

        return rawClauses.map((raw: Record<string, string>) => {
            const clauseType = VALID_CLAUSE_TYPES.includes(raw.clause_type as ClauseType)
                ? raw.clause_type as ClauseType
                : 'other'

            const content = String(raw.text || raw.content || '').trim()

            return {
                clauseType,
                sectionTitle: raw.section_title || null,
                sectionNumber: raw.section_number || null,
                content,
                chunkRef: windowIndex !== undefined ? `window_${windowIndex}` : null
            }
        }).filter((c: { content: string }) => c.content.length > 0)
    } catch (err) {
        logger.error('lib', `[DocIntel] Clause extraction failed for window${windowInfo ? ` (${windowInfo})` : ''}:`, err)
        return []
    }
}

/**
 * Normalize text for deduplication comparison.
 * Lowercases, collapses whitespace, strips common punctuation variations.
 */
function normalizeForDedup(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\s]+/g, ' ')
        .replace(/[""'']/g, '"')
        .replace(/[–—]/g, '-')
        .trim()
}

/**
 * Extract and store legal clauses from a document.
 * 
 * KEY IMPROVEMENTS:
 * - Processes full document via overlapping text windows
 * - Improved deduplication using normalized content (not just first 100 chars)
 * - Links clauses to document windows via chunkRef
 * - Supports force re-extraction (when called after clearing existing clauses)
 */
export async function extractClauses(
    fileId: string,
    projectId: string,
    text: string,
    options?: { force?: boolean }
): Promise<DocumentClause[]> {
    try {
        // 1. Check for existing clauses (idempotent)
        if (!options?.force) {
            const { count } = await supabase
                .from('document_clauses')
                .select('*', { count: 'exact', head: true })
                .eq('file_id', fileId)

            if (count && count > 0) {
                logger.info("document-intelligence/clauses", `[DocIntel] Clauses already exist for file ${fileId}, skipping`)
                return []
            }
        }

        // 2. Split text into windows
        const windows: string[] = []
        if (text.length <= CLAUSE_WINDOW_SIZE) {
            windows.push(text)
        } else {
            let offset = 0
            while (offset < text.length && windows.length < MAX_CLAUSE_WINDOWS) {
                const end = Math.min(offset + CLAUSE_WINDOW_SIZE, text.length)
                let windowText = text.slice(offset, end)

                // Break at sentence boundary
                if (end < text.length) {
                    const lastBreak = Math.max(
                        windowText.lastIndexOf('. '),
                        windowText.lastIndexOf('\n')
                    )
                    if (lastBreak > CLAUSE_WINDOW_SIZE * 0.6) {
                        windowText = windowText.slice(0, lastBreak + 1)
                    }
                }

                windows.push(windowText.trim())
                offset += windowText.length - CLAUSE_WINDOW_OVERLAP

                if (text.length - offset < CLAUSE_WINDOW_OVERLAP) {
                    const remaining = text.slice(offset).trim()
                    if (remaining.length > 50) windows.push(remaining)
                    break
                }
            }
        }

        logger.info("document-intelligence/clauses", `[DocIntel] Extracting clauses from ${windows.length} window(s) for file ${fileId}`)

        // 3. Extract clauses from all windows in parallel
        const allWindowClauses = await Promise.all(
            windows.map((windowText, idx) => {
                const windowInfo = windows.length > 1
                    ? `window ${idx + 1} of ${windows.length}`
                    : undefined
                return extractClausesFromWindow(windowText, windowInfo, idx)
            })
        )

        // 4. Flatten and deduplicate
        const rawClauses = allWindowClauses.flat()

        if (rawClauses.length === 0) {
            logger.info("document-intelligence/clauses", `[DocIntel] No clauses detected for file ${fileId}`)
            return []
        }

        const seen = new Set<string>()
        const clauses: DocumentClause[] = []

        for (const raw of rawClauses) {
            // Improved dedup: normalize full content, compare by type + normalized content
            const normalizedContent = normalizeForDedup(raw.content)
            const dedupeKey = `${raw.clauseType}:${normalizedContent.substring(0, 200)}`
            if (seen.has(dedupeKey)) continue
            seen.add(dedupeKey)

            clauses.push({
                fileId,
                projectId,
                clauseType: raw.clauseType,
                sectionTitle: raw.sectionTitle,
                sectionNumber: raw.sectionNumber,
                content: raw.content,
                chunkRef: raw.chunkRef
            })
        }

        // 5. Batch insert into database
        if (clauses.length > 0) {
            const records = clauses.map(c => ({
                file_id: c.fileId,
                project_id: c.projectId,
                clause_type: c.clauseType,
                section_title: c.sectionTitle,
                section_number: c.sectionNumber,
                content: c.content,
                chunk_ref: c.chunkRef
            }))

            const { error } = await supabase
                .from('document_clauses')
                .insert(records)

            if (error) {
                logger.error('lib', `[DocIntel] Failed to insert clauses for file ${fileId}:`, error)
                return []
            }

            logger.info("document-intelligence/clauses", `[DocIntel] Stored ${clauses.length} clauses for file ${fileId} (from ${windows.length} windows)`)
        }

        return clauses
    } catch (error) {
        logger.error('lib', `[DocIntel] Clause extraction failed for file ${fileId}:`, error)
        return []
    }
}

/**
 * Retrieve clauses across a project, optionally filtered by clause type.
 */
export async function retrieveClauses(
    projectId: string,
    clauseType?: ClauseType
): Promise<DocumentClause[]> {
    try {
        let query = supabase
            .from('document_clauses')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (clauseType) {
            query = query.eq('clause_type', clauseType)
        }

        const { data, error } = await query

        if (error) {
            logger.error('[DocIntel] Failed to retrieve clauses:', 'Error occurred', error)
            return []
        }

        return (data || []).map(c => ({
            id: c.id,
            fileId: c.file_id,
            projectId: c.project_id,
            clauseType: c.clause_type as ClauseType,
            sectionTitle: c.section_title,
            sectionNumber: c.section_number,
            content: c.content,
            chunkRef: c.chunk_ref,
            createdAt: c.created_at
        }))
    } catch (error) {
        logger.error('[DocIntel] Clause retrieval error:', 'Error occurred', error)
        return []
    }
}
