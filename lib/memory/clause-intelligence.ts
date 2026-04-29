import { logger } from '@/lib/logger'
/**
 * Clause Intelligence — Clause Pattern Normalization & Cross-Matter Analytics
 *
 * Normalizes clause structures from document extraction,
 * tracks frequency across org documents, and links to outcomes.
 *
 * Enables queries like:
 *   "This indemnification cap structure was used in 12 of our last 15 M&A deals"
 *   "What is our standard non-compete clause for employment agreements?"
 */

import { supabase } from '@/lib/supabase/server'
import { embedText } from '@/lib/rag/embeddings'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface ClausePattern {
    id: string
    organization_id: string
    clause_type: string
    normalized_text: string
    jurisdiction: string | null
    risk_level: 'high' | 'medium' | 'low'
    frequency: number
    example_project_ids: string[]
    metadata: Record<string, unknown>
    created_at: string
}

interface ExtractedClause {
    clauseType: string
    content: string
    jurisdiction?: string
    riskLevel?: 'high' | 'medium' | 'low'
    projectId: string
}

// ═══════════════════════════════════════════════════
// CLAUSE NORMALIZATION
// ═══════════════════════════════════════════════════

/**
 * Normalize a clause text for comparison.
 * Strips legal boilerplate, standardizes formatting.
 */
function normalizeClauseText(text: string): string {
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[""'']/g, '"')
        .replace(/\b(the|a|an|of|in|to|for|and|or|by|with|at|on)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Detect clause type from content using keyword matching.
 */
function classifyClauseType(text: string): string {
    const lower = text.toLowerCase()

    const patterns: Array<[string, string[]]> = [
        ['indemnification', ['indemnif', 'hold harmless', 'indemnity']],
        ['non_compete', ['non-compete', 'non compete', 'covenant not to compete', 'restrictive covenant']],
        ['non_solicitation', ['non-solicitation', 'non solicitation', 'solicit']],
        ['confidentiality', ['confidential', 'non-disclosure', 'nda', 'proprietary information']],
        ['termination', ['terminat', 'cancellation', 'right to terminate']],
        ['force_majeure', ['force majeure', 'act of god', 'beyond reasonable control']],
        ['governing_law', ['governing law', 'choice of law', 'governed by', 'laws of']],
        ['arbitration', ['arbitration', 'dispute resolution', 'arbitrat']],
        ['liability_cap', ['limitation of liability', 'liability cap', 'aggregate liability', 'maximum liability']],
        ['ip_assignment', ['intellectual property', 'ip assignment', 'work product', 'inventions']],
        ['data_protection', ['data protection', 'gdpr', 'personal data', 'data processing']],
        ['warranty', ['warrant', 'representation', 'represent and warrant']],
        ['severability', ['severab', 'invalid provision', 'unenforceable']],
        ['entire_agreement', ['entire agreement', 'whole agreement', 'supersedes']],
    ]

    for (const [type, keywords] of patterns) {
        if (keywords.some(kw => lower.includes(kw))) {
            return type
        }
    }

    return 'other'
}

// ═══════════════════════════════════════════════════
// PATTERN STORAGE & MATCHING
// ═══════════════════════════════════════════════════

/**
 * Store or update a clause pattern.
 * If a similar pattern exists, increment frequency. Otherwise create new.
 */
export async function storeClausePattern(params: {
    organizationId: string
    clause: ExtractedClause
}): Promise<string | null> {
    const { organizationId, clause } = params
    const clauseType = clause.clauseType || classifyClauseType(clause.content)
    const normalized = normalizeClauseText(clause.content)

    // Check for existing similar pattern (by clause type + text similarity)
    const { data: existing } = await supabase
        .from('clause_patterns')
        .select('id, frequency, example_project_ids')
        .eq('organization_id', organizationId)
        .eq('clause_type', clauseType)
        .limit(10)

    // Simple text overlap check for similarity
    for (const pattern of existing || []) {
        const existingNorm = normalizeClauseText((pattern as Record<string, unknown>).normalized_text as string || '')
        const overlap = computeTextOverlap(normalized, existingNorm)

        if (overlap > 0.7) {
            // Update existing pattern
            const projectIds = ((pattern as Record<string, unknown>).example_project_ids as string[]) || []
            if (!projectIds.includes(clause.projectId)) {
                projectIds.push(clause.projectId)
            }

            await supabase
                .from('clause_patterns')
                .update({
                    frequency: ((pattern as Record<string, unknown>).frequency as number || 0) + 1,
                    example_project_ids: projectIds,
                    metadata: { last_seen_at: new Date().toISOString() },
                })
                .eq('id', (pattern as Record<string, unknown>).id)

            return (pattern as Record<string, unknown>).id as string
        }
    }

    // Create new pattern
    let embedding: number[] | null = null
    try {
        embedding = await embedText(clause.content.slice(0, 500))
    } catch {
        // Embedding optional
    }

    const { data, error } = await supabase
        .from('clause_patterns')
        .insert({
            organization_id: organizationId,
            clause_type: clauseType,
            normalized_text: clause.content.slice(0, 2000),
            jurisdiction: clause.jurisdiction || null,
            risk_level: clause.riskLevel || 'medium',
            frequency: 1,
            example_project_ids: [clause.projectId],
            embedding,
            metadata: {
                created_from: 'clause_intelligence',
                original_length: clause.content.length,
            },
        })
        .select('id')
        .single()

    if (error) {
        logger.warn('[Clause Intelligence] Failed to store pattern:', 'Error occurred', error.message)
        return null
    }

    return data?.id || null
}

/**
 * Get the most common clause patterns for an organization.
 */
export async function getTopClausePatterns(params: {
    organizationId: string
    clauseType?: string
    jurisdiction?: string
    minFrequency?: number
    limit?: number
}): Promise<ClausePattern[]> {
    let query = supabase
        .from('clause_patterns')
        .select('*')
        .eq('organization_id', params.organizationId)
        .gte('frequency', params.minFrequency || 2)
        .order('frequency', { ascending: false })
        .limit(params.limit || 20)

    if (params.clauseType) {
        query = query.eq('clause_type', params.clauseType)
    }
    if (params.jurisdiction) {
        query = query.eq('jurisdiction', params.jurisdiction)
    }

    const { data } = await query
    return (data || []) as unknown as ClausePattern[]
}

/**
 * Batch process clauses from a document and store patterns.
 */
export async function processDocumentClauses(params: {
    organizationId: string
    projectId: string
    clauses: Array<{ clauseType: string; content: string; jurisdiction?: string }>
}): Promise<number> {
    let stored = 0
    for (const clause of params.clauses) {
        const result = await storeClausePattern({
            organizationId: params.organizationId,
            clause: {
                clauseType: clause.clauseType,
                content: clause.content,
                jurisdiction: clause.jurisdiction,
                projectId: params.projectId,
            },
        })
        if (result) stored++
    }
    return stored
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

/**
 * Compute word-level overlap between two normalized texts.
 */
function computeTextOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2))
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2))

    if (words1.size === 0 || words2.size === 0) return 0

    let overlap = 0
    for (const word of words1) {
        if (words2.has(word)) overlap++
    }

    return overlap / Math.max(words1.size, words2.size)
}
