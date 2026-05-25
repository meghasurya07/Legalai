/**
 * Trust & Insight Layer — Conflict Detection Engine
 * 
 * Compares clauses across documents within a project to
 * identify contradictions (governing law, jurisdiction, etc.).
 * 
 * KEY UPGRADES:
 * - H31: Incremental detection — re-runs when new clauses exist since last run
 * - H32: Increased clause comparison limits (10 per type vs 6)
 */

import { callAI } from '@/lib/ai/client'
import { AI_TOKENS, AI_MODELS } from '@/lib/ai/config'
import { supabase } from '@/lib/supabase/server'
import { parseAIJSON } from '@/lib/api-utils'
import { retrieveClauses } from '@/lib/document-intelligence'
import type { ConflictType, Severity } from './types'
import { logger } from '@/lib/logger'

/**
 * Detect conflicts across project documents.
 * Compares clauses of the same type from different files.
 * 
 * Incremental: only re-runs if new clauses have been added since the last run.
 * Pass `options.force` to bypass the incremental check.
 */
export async function detectConflicts(
    projectId: string,
    options?: { force?: boolean }
): Promise<number> {
    try {
        logger.info("trust/conflicts", `[Trust] Starting conflict detection for project ${projectId}`)

        // 1. Get all clauses for this project
        const clauses = await retrieveClauses(projectId)

        if (clauses.length < 2) {
            logger.info("trust/conflicts", '[Trust] Not enough clauses for conflict detection')
            return 0
        }

        // 2. Check if re-detection is needed (incremental)
        if (!options?.force) {
            const { count: existing } = await supabase
                .from('project_conflicts')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId)

            // If conflicts already exist, check if any new clauses were added
            if (existing && existing > 0) {
                // Get the latest conflict's created_at
                const { data: latestConflict } = await supabase
                    .from('project_conflicts')
                    .select('created_at')
                    .eq('project_id', projectId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (latestConflict) {
                    // Check if any document_clauses were created after the last conflict run
                    const { count: newClauses } = await supabase
                        .from('document_clauses')
                        .select('*', { count: 'exact', head: true })
                        .eq('project_id', projectId)
                        .gt('created_at', latestConflict.created_at)

                    if (!newClauses || newClauses === 0) {
                        logger.info("trust/conflicts", `[Trust] No new clauses since last detection (${existing} existing conflicts), skipping`)
                        return existing
                    }

                    logger.info("trust/conflicts", `[Trust] ${newClauses} new clauses detected, re-running conflict analysis`)
                }
            }
        }

        // 3. Clear old conflicts before re-running (incremental refresh)
        await supabase
            .from('project_conflicts')
            .delete()
            .eq('project_id', projectId)

        // 4. Group clauses by type and find cross-document pairs
        const byType = new Map<string, typeof clauses>()
        for (const c of clauses) {
            const list = byType.get(c.clauseType) || []
            list.push(c)
            byType.set(c.clauseType, list)
        }

        // 5. For each clause type with multiple files, check for conflicts
        const conflictClauses: string[] = []
        const clauseFileMap: Array<{ type: string; fileId: string; content: string }> = []

        for (const [type, typeClauses] of byType) {
            const fileIds = new Set(typeClauses.map(c => c.fileId))
            if (fileIds.size < 2) continue // Need cross-doc

            // Take up to 10 per clause type for more thorough comparison (H32)
            for (const c of typeClauses.slice(0, 10)) {
                conflictClauses.push(`[${type}] (File: ${c.fileId}): ${c.content.slice(0, 400)}`)
                clauseFileMap.push({ type, fileId: c.fileId, content: c.content })
            }
        }

        if (conflictClauses.length < 2) {
            logger.info("trust/conflicts", '[Trust] No cross-document clause pairs found')
            return 0
        }

        // 6. AI-powered conflict analysis
        const { result } = await callAI('conflict_detection', {
            text: conflictClauses.join('\n\n')
        }, {
            jsonMode: true,
            maxTokens: AI_TOKENS.trust,
            temperature: 0.1, // Low temperature for precise factual analysis
            model: AI_MODELS.trust,
        })

        const parsed = parseAIJSON(result, undefined)
        const conflicts = Array.isArray(parsed?.conflicts) ? parsed.conflicts : []

        // 7. Persist conflicts
        let count = 0
        for (const conflict of conflicts) {
            const { error } = await supabase
                .from('project_conflicts')
                .insert({
                    project_id: projectId,
                    conflict_type: (conflict.type || 'other') as ConflictType,
                    entity_a: String(conflict.entity_a || conflict.clause_a || ''),
                    entity_b: String(conflict.entity_b || conflict.clause_b || ''),
                    description: String(conflict.description || ''),
                    severity: (['high', 'medium', 'low'].includes(conflict.severity) ? conflict.severity : 'medium') as Severity,
                    related_file_ids: conflict.file_ids || []
                })

            if (!error) count++
        }

        logger.info("trust/conflicts", `[Trust] Detected ${count} conflicts for project ${projectId}`)
        return count

    } catch (error) {
        logger.error('[Trust] Conflict detection failed:', 'Error occurred', error)
        return 0
    }
}

/**
 * Retrieve existing conflicts for a project.
 */
export async function retrieveConflicts(projectId: string): Promise<string> {
    const { data, error } = await supabase
        .from('project_conflicts')
        .select('*')
        .eq('project_id', projectId)
        .order('severity', { ascending: true })
        .limit(10)

    if (error || !data || data.length === 0) return ''

    return data.map(c =>
        `- [${(c.severity as string).toUpperCase()}] ${c.conflict_type}: ${c.description}`
    ).join('\n')
}
