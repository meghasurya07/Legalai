/**
 * Trust & Insight Layer — Conflict Detection Engine
 * 
 * Compares clauses across documents within a project to
 * identify contradictions (governing law, jurisdiction, etc.).
 */

import { callAI } from '@/lib/ai/client'
import { AI_TOKENS } from '@/lib/ai/config'
import { supabase } from '@/lib/supabase/server'
import { parseAIJSON } from '@/lib/api-utils'
import { retrieveClauses } from '@/lib/document-intelligence'
import type { ConflictType, Severity } from './types'

/**
 * Detect conflicts across project documents.
 * Compares clauses of the same type from different files.
 */
export async function detectConflicts(projectId: string): Promise<number> {
    try {
        console.log(`[Trust] Starting conflict detection for project ${projectId}`)

        // 1. Check for existing conflicts (avoid re-running)
        const { count: existing } = await supabase
            .from('project_conflicts')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)

        if (existing && existing > 0) {
            console.log(`[Trust] Conflicts already detected (${existing}), skipping`)
            return existing
        }

        // 2. Get all clauses for this project
        const clauses = await retrieveClauses(projectId)

        if (clauses.length < 2) {
            console.log('[Trust] Not enough clauses for conflict detection')
            return 0
        }

        // 3. Group clauses by type and find cross-document pairs
        const byType = new Map<string, typeof clauses>()
        for (const c of clauses) {
            const list = byType.get(c.clauseType) || []
            list.push(c)
            byType.set(c.clauseType, list)
        }

        // 4. For each clause type with multiple files, check for conflicts
        const conflictClauses: string[] = []
        const clauseFileMap: Array<{ type: string; fileId: string; content: string }> = []

        for (const [type, typeClauses] of byType) {
            const fileIds = new Set(typeClauses.map(c => c.fileId))
            if (fileIds.size < 2) continue // Need cross-doc

            // Take up to 2 per file for comparison
            for (const c of typeClauses.slice(0, 6)) {
                conflictClauses.push(`[${type}] (File: ${c.fileId}): ${c.content.slice(0, 300)}`)
                clauseFileMap.push({ type, fileId: c.fileId, content: c.content })
            }
        }

        if (conflictClauses.length < 2) {
            console.log('[Trust] No cross-document clause pairs found')
            return 0
        }

        // 5. AI-powered conflict analysis
        const { result } = await callAI('conflict_detection', {
            text: conflictClauses.join('\n\n')
        }, {
            jsonMode: true,
            maxTokens: AI_TOKENS.trust
        })

        const parsed = parseAIJSON(result, undefined)
        const conflicts = Array.isArray(parsed?.conflicts) ? parsed.conflicts : []

        // 6. Persist conflicts
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

        console.log(`[Trust] Detected ${count} conflicts for project ${projectId}`)
        return count

    } catch (error) {
        console.error('[Trust] Conflict detection failed:', error)
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
