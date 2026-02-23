/**
 * Document Intelligence — Clause Extraction Engine
 * 
 * Detects, classifies, and stores legal clauses from document text.
 * Avoids duplicates by checking for existing clause records.
 */

import { callAI } from '@/lib/ai/client'
import { supabase } from '@/lib/supabase/server'
import { buildClausePrompt } from './prompts'
import type { DocumentClause, ClauseType } from './types'

const VALID_CLAUSE_TYPES: ClauseType[] = [
    'termination', 'indemnity', 'confidentiality', 'liability',
    'jurisdiction', 'payment', 'intellectual_property', 'dispute_resolution',
    'force_majeure', 'non_compete', 'warranty', 'other'
]

/**
 * Extract and store legal clauses from a document.
 * Idempotent — skips if clauses already exist for this file.
 */
export async function extractClauses(
    fileId: string,
    projectId: string,
    text: string
): Promise<DocumentClause[]> {
    try {
        // 1. Check for existing clauses (idempotent)
        const { count } = await supabase
            .from('document_clauses')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', fileId)

        if (count && count > 0) {
            console.log(`[DocIntel] Clauses already exist for file ${fileId}, skipping`)
            return []
        }

        // 2. Run AI clause detection
        const { systemPrompt, userPrompt } = buildClausePrompt(text)

        const { result } = await callAI('doc_intel_clauses' as import('@/lib/ai/prompts').UseCase, {
            systemOverride: systemPrompt,
            userOverride: userPrompt,
            text
        }, {
            jsonMode: true,
            maxTokens: 2000,
            model: 'gpt-4o-mini'
        })

        const parsed = JSON.parse(result)
        const rawClauses = Array.isArray(parsed.clauses) ? parsed.clauses : []

        if (rawClauses.length === 0) {
            console.log(`[DocIntel] No clauses detected for file ${fileId}`)
            return []
        }

        // 3. Map and validate clauses
        const seen = new Set<string>()
        const clauses: DocumentClause[] = []

        for (const raw of rawClauses) {
            const clauseType = VALID_CLAUSE_TYPES.includes(raw.clause_type)
                ? raw.clause_type as ClauseType
                : 'other'

            const content = String(raw.text || raw.content || '').trim()
            if (!content) continue

            // Deduplicate by clause_type + content hash
            const dedupeKey = `${clauseType}:${content.substring(0, 100)}`
            if (seen.has(dedupeKey)) continue
            seen.add(dedupeKey)

            clauses.push({
                fileId,
                projectId,
                clauseType,
                sectionTitle: raw.section_title || null,
                sectionNumber: raw.section_number || null,
                content,
                chunkRef: null
            })
        }

        // 4. Batch insert into database
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
                console.error(`[DocIntel] Failed to insert clauses for file ${fileId}:`, error)
                return []
            }

            console.log(`[DocIntel] Stored ${clauses.length} clauses for file ${fileId}`)
        }

        return clauses
    } catch (error) {
        console.error(`[DocIntel] Clause extraction failed for file ${fileId}:`, error)
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
            console.error('[DocIntel] Failed to retrieve clauses:', error)
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
        console.error('[DocIntel] Clause retrieval error:', error)
        return []
    }
}
