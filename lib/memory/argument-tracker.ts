import { logger } from '@/lib/logger'
/**
 * Argument Tracker — Silent extraction and classification of legal arguments
 *
 * Phase 4 of the Wesley Memory Layer.
 * Runs silently in the background to:
 *   1. Extract legal arguments from conversations
 *   2. Link arguments to outcomes when available
 *   3. Track argument success patterns over time
 *   4. Build institutional intelligence on what works
 */

import { supabase } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/client'
import { parseAIJSON } from '@/lib/api-utils'
import { embedText } from '@/lib/rag/embeddings'

// ─── Types ───────────────────────────────────────────────

export interface ArgumentRecord {
    id?: string
    project_id: string
    organization_id?: string
    argument_text: string
    argument_type: ArgumentType
    legal_basis?: string
    jurisdiction?: string
    practice_area?: string
    strength_assessment: number  // 0.0 - 1.0
    outcome?: ArgumentOutcome
    outcome_details?: string
    counter_arguments?: string[]
    supporting_evidence?: string[]
    source_conversation_id?: string
    source_memory_ids?: string[]
    embedding?: number[]
    metadata?: Record<string, unknown>
}

export type ArgumentType =
    | 'procedural'      // Procedural/technical arguments
    | 'substantive'     // Core legal merits
    | 'evidentiary'     // Evidence-based arguments
    | 'policy'          // Policy/public interest arguments
    | 'contractual'     // Contract interpretation
    | 'statutory'       // Statutory interpretation
    | 'precedent'       // Precedent-based arguments
    | 'equitable'       // Equitable/fairness arguments

export type ArgumentOutcome =
    | 'accepted'        // Argument was accepted by the court/tribunal
    | 'rejected'        // Argument was rejected
    | 'partially_accepted'
    | 'settled'         // Matter settled before ruling
    | 'pending'         // Outcome not yet known
    | 'withdrawn'       // Argument was withdrawn

// ─── Extraction ──────────────────────────────────────────

/**
 * Extract arguments from a text block (conversation or document).
 * Called asynchronously after memory extraction.
 */
export async function extractArguments(
    text: string,
    projectId: string,
    organizationId?: string,
    conversationId?: string
): Promise<ArgumentRecord[]> {
    try {
        const { result } = await callAI('memory_extraction', {
            text: `Analyze this legal text and extract any LEGAL ARGUMENTS being made, discussed, or referenced.

TEXT:
${text.slice(0, 8000)}

Return JSON:
{
  "arguments": [
    {
      "argument_text": "The complete argument statement",
      "argument_type": "procedural|substantive|evidentiary|policy|contractual|statutory|precedent|equitable",
      "legal_basis": "The law, statute, or precedent the argument relies on (if mentioned)",
      "jurisdiction": "The jurisdiction (if identifiable)",
      "practice_area": "The area of law (e.g., corporate, IP, employment)",
      "strength_assessment": 0.0-1.0,
      "counter_arguments": ["Any counter-arguments mentioned"],
      "supporting_evidence": ["Key evidence supporting the argument"]
    }
  ]
}

Rules:
- Only extract ACTUAL legal arguments, not general statements
- strength_assessment: 1.0 = very strong argument with solid basis, 0.5 = moderate, 0.0 = weak
- If no arguments are found, return {"arguments": []}
- Be specific about the legal basis when mentioned
- Capture the FULL argument, not just a summary`,
        }, { jsonMode: true })

        const parsed = parseAIJSON(result, undefined)
        if (!parsed?.arguments || !Array.isArray(parsed.arguments)) return []

        const records: ArgumentRecord[] = []

        for (const arg of parsed.arguments) {
            if (!arg.argument_text || arg.argument_text.length < 20) continue

            const record: ArgumentRecord = {
                project_id: projectId,
                organization_id: organizationId,
                argument_text: arg.argument_text,
                argument_type: validateArgumentType(arg.argument_type),
                legal_basis: arg.legal_basis || undefined,
                jurisdiction: arg.jurisdiction || undefined,
                practice_area: arg.practice_area || undefined,
                strength_assessment: Math.max(0, Math.min(1, parseFloat(arg.strength_assessment) || 0.5)),
                outcome: 'pending',
                counter_arguments: Array.isArray(arg.counter_arguments) ? arg.counter_arguments : [],
                supporting_evidence: Array.isArray(arg.supporting_evidence) ? arg.supporting_evidence : [],
                source_conversation_id: conversationId,
            }

            records.push(record)
        }

        return records
    } catch (err) {
        logger.warn('[ArgumentTracker] Extraction failed:', 'Error occurred', err)
        return []
    }
}

/**
 * Persist extracted arguments to the database.
 */
export async function persistArguments(args: ArgumentRecord[]): Promise<void> {
    if (args.length === 0) return

    for (const arg of args) {
        try {
            // Generate embedding for similarity search
            let embedding: number[] | undefined
            try {
                embedding = await embedText(arg.argument_text)
            } catch {
                // Continue without embedding
            }

            // Check for duplicate arguments (semantic dedup)
            if (embedding) {
                const { data: existing } = await supabase.rpc('match_memories', {
                    query_embedding: JSON.stringify(embedding),
                    match_threshold: 0.9,
                    match_count: 1,
                    filter_project_id: arg.project_id,
                    filter_org_id: null,
                    filter_types: ['argument'],
                })

                if (existing && existing.length > 0) {
                    // Already have a very similar argument — skip
                    continue
                }
            }

            // Insert into arguments table
            await supabase.from('arguments').insert({
                project_id: arg.project_id,
                organization_id: arg.organization_id || null,
                argument_text: arg.argument_text,
                argument_type: arg.argument_type,
                legal_basis: arg.legal_basis || null,
                jurisdiction: arg.jurisdiction || null,
                practice_area: arg.practice_area || null,
                strength_assessment: arg.strength_assessment,
                outcome: arg.outcome || 'pending',
                outcome_details: arg.outcome_details || null,
                counter_arguments: arg.counter_arguments || [],
                supporting_evidence: arg.supporting_evidence || [],
                source_conversation_id: arg.source_conversation_id || null,
                embedding: embedding ? JSON.stringify(embedding) : null,
                metadata: arg.metadata || {},
            })
        } catch (err) {
            logger.warn('[ArgumentTracker] Persist failed for argument:', 'Error occurred', err)
        }
    }
}

/**
 * Link an argument to its outcome.
 * Called when outcome information is detected in subsequent conversations.
 */
export async function updateArgumentOutcome(
    argumentId: string,
    outcome: ArgumentOutcome,
    outcomeDetails?: string
): Promise<void> {
    try {
        await supabase
            .from('arguments')
            .update({
                outcome,
                outcome_details: outcomeDetails || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', argumentId)
    } catch (err) {
        logger.warn('[ArgumentTracker] Outcome update failed:', 'Error occurred', err)
    }
}

/**
 * Get argument success patterns for a practice area or jurisdiction.
 * Used by firm intelligence to surface what works.
 */
export async function getArgumentPatterns(
    organizationId: string,
    filters?: {
        practiceArea?: string
        jurisdiction?: string
        argumentType?: ArgumentType
    }
): Promise<{
    total: number
    accepted: number
    rejected: number
    success_rate: number
    patterns: Array<{
        argument_type: ArgumentType
        count: number
        success_rate: number
    }>
}> {
    try {
        let query = supabase
            .from('arguments')
            .select('argument_type, outcome')
            .eq('organization_id', organizationId)

        if (filters?.practiceArea) {
            query = query.eq('practice_area', filters.practiceArea)
        }
        if (filters?.jurisdiction) {
            query = query.eq('jurisdiction', filters.jurisdiction)
        }
        if (filters?.argumentType) {
            query = query.eq('argument_type', filters.argumentType)
        }

        const { data } = await query

        if (!data || data.length === 0) {
            return { total: 0, accepted: 0, rejected: 0, success_rate: 0, patterns: [] }
        }

        const total = data.length
        const accepted = data.filter(d => d.outcome === 'accepted' || d.outcome === 'partially_accepted').length
        const rejected = data.filter(d => d.outcome === 'rejected').length

        // Group by type
        const byType: Record<string, { total: number; success: number }> = {}
        for (const row of data) {
            const type = row.argument_type as string
            if (!byType[type]) byType[type] = { total: 0, success: 0 }
            byType[type].total++
            if (row.outcome === 'accepted' || row.outcome === 'partially_accepted') {
                byType[type].success++
            }
        }

        const patterns = Object.entries(byType).map(([type, stats]) => ({
            argument_type: type as ArgumentType,
            count: stats.total,
            success_rate: stats.total > 0 ? stats.success / stats.total : 0,
        }))

        return {
            total,
            accepted,
            rejected,
            success_rate: total > 0 ? accepted / total : 0,
            patterns: patterns.sort((a, b) => b.success_rate - a.success_rate),
        }
    } catch (err) {
        logger.warn('[ArgumentTracker] Pattern analysis failed:', 'Error occurred', err)
        return { total: 0, accepted: 0, rejected: 0, success_rate: 0, patterns: [] }
    }
}

// ─── Helpers ─────────────────────────────────────────────

function validateArgumentType(type: string): ArgumentType {
    const valid: ArgumentType[] = [
        'procedural', 'substantive', 'evidentiary', 'policy',
        'contractual', 'statutory', 'precedent', 'equitable',
    ]
    return valid.includes(type as ArgumentType) ? (type as ArgumentType) : 'substantive'
}
