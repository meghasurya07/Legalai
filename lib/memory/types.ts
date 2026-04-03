/**
 * Wesley Memory Layer — Type Definitions
 *
 * Unified type system for the multi-layered memory architecture.
 * Covers: memories, arguments, clause patterns, firm patterns, access logs.
 */

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

/** Minimum confidence score for memory persistence */
export const CONFIDENCE_THRESHOLD = 0.6

/** Maximum tokens of memory context injected into prompts */
export const MEMORY_TOKEN_BUDGET = 3000

/** Daily decay multiplier for unaccessed memories */
export const DECAY_RATE = 0.995

/** Below this decay_weight, a memory is considered stale */
export const STALE_THRESHOLD = 0.2

/** Max memories returned per retrieval query */
export const MAX_RETRIEVAL_COUNT = 20

/** Authority weights by source type */
export const AUTHORITY_WEIGHTS: Record<MemorySource, number> = {
    manual: 1.0,
    document: 0.9,
    workflow: 0.85,
    chat: 0.7,
    system: 0.5,
}

// ═══════════════════════════════════════════════════
// MEMORY TYPES
// ═══════════════════════════════════════════════════

export type MemoryType =
    | 'fact'
    | 'decision'
    | 'risk'
    | 'obligation'
    | 'insight'
    | 'preference'
    | 'argument'
    | 'outcome'
    | 'procedure'
    | 'pattern'
    | 'correction'

export type MemorySource = 'chat' | 'document' | 'workflow' | 'manual' | 'system'

export type MemoryCategory = 'personal' | 'case' | 'firm'

export interface MemoryItem {
    id: string
    organization_id: string | null
    project_id: string | null
    user_id: string | null

    memory_type: MemoryType
    content: string
    embedding?: number[] | null

    source: MemorySource
    source_id: string | null
    source_context: string | null

    confidence: number
    importance: number
    authority_weight: number
    decay_weight: number
    reinforcement_count: number

    is_pinned: boolean
    is_active: boolean
    last_accessed_at: string | null

    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
}

// ═══════════════════════════════════════════════════
// EXTRACTION TYPES
// ═══════════════════════════════════════════════════

/** Raw output from AI extraction before persistence */
export interface ExtractedMemory {
    content: string
    type: MemoryType
    importance: number
    confidence: number
    reasoning: string
    source_context?: string
}

/** Input to the extraction pipeline */
export interface ExtractionInput {
    projectId: string
    organizationId?: string
    userId?: string
    text: string
    source: MemorySource
    sourceId?: string
}

/** Result from extraction pipeline */
export interface ExtractionResult {
    extracted: ExtractedMemory[]
    persisted: number
    rejected: number
    duplicates: number
}

// ═══════════════════════════════════════════════════
// RETRIEVAL TYPES
// ═══════════════════════════════════════════════════

/** Result from hybrid memory retrieval */
export interface MemoryRetrievalResult {
    id: string
    content: string
    memory_type: MemoryType
    source: MemorySource
    confidence: number
    importance: number
    authority_weight: number
    is_pinned: boolean
    project_id: string | null
    created_at: string
    relevance_score: number
    retrieval_path: 'vector' | 'graph' | 'structured'
    metadata: Record<string, unknown>
}

/** Query intent classification */
export type QueryIntent =
    | 'factual_lookup'
    | 'analysis'
    | 'drafting'
    | 'comparison'
    | 'cross_case'
    | 'preference_check'

/** Query analysis result */
export interface QueryAnalysis {
    intent: QueryIntent
    entities: string[]
    temporal_scope: 'recent' | 'historical' | 'all'
    retrieval_scope: 'project_only' | 'cross_case' | 'firm_wide'
    memory_types: MemoryType[]
}

/** Assembled memory context ready for prompt injection */
export interface MemoryContext {
    project_memories: MemoryRetrievalResult[]
    firm_patterns: FirmPatternItem[]
    user_preferences: MemoryRetrievalResult[]
    total_tokens: number
    formatted_text: string
}

// ═══════════════════════════════════════════════════
// ARGUMENT TYPES
// ═══════════════════════════════════════════════════

export type ArgumentType =
    | 'offense'
    | 'defense'
    | 'procedural'
    | 'evidentiary'
    | 'statutory'
    | 'constitutional'

export type ArgumentOutcome = 'won' | 'lost' | 'settled' | 'pending' | 'partial'

export interface ArgumentItem {
    id: string
    organization_id: string | null
    project_id: string | null

    argument_text: string
    argument_type: ArgumentType
    jurisdiction: string | null
    practice_area: string | null
    court_level: string | null

    outcome: ArgumentOutcome | null
    outcome_notes: string | null
    outcome_date: string | null

    related_entity_ids: string[]
    related_memory_ids: string[]

    embedding?: number[] | null
    metadata: Record<string, unknown>
    created_at: string
}

export interface ExtractedArgument {
    argument_text: string
    argument_type: ArgumentType
    jurisdiction?: string
    practice_area?: string
    confidence: number
}

// ═══════════════════════════════════════════════════
// CLAUSE PATTERN TYPES
// ═══════════════════════════════════════════════════

export interface ClausePatternItem {
    id: string
    organization_id: string | null
    clause_type: string
    normalized_text: string
    occurrence_count: number
    source_project_ids: string[]
    source_file_ids: string[]
    embedding?: number[] | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
}

// ═══════════════════════════════════════════════════
// FIRM PATTERN TYPES
// ═══════════════════════════════════════════════════

export type FirmPatternType =
    | 'clause_standard'
    | 'risk_distribution'
    | 'argument_success_rate'
    | 'jurisdiction_preference'
    | 'common_procedure'
    | 'negotiation_pattern'

export type FirmAccessLevel = 'admin' | 'lawyer' | 'all'

export interface FirmPatternItem {
    id: string
    organization_id: string | null
    pattern_type: FirmPatternType
    title: string
    description: string
    evidence_count: number
    confidence: number
    source_project_ids: string[]
    access_level: FirmAccessLevel
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
}

// ═══════════════════════════════════════════════════
// ACCESS LOG TYPES
// ═══════════════════════════════════════════════════

export type AccessFeedback = 'positive' | 'negative'

export interface MemoryAccessLogEntry {
    id: string
    memory_id: string
    conversation_id: string | null
    user_id: string | null
    retrieval_score: number | null
    was_cited: boolean
    feedback: AccessFeedback | null
    created_at: string
}

// ═══════════════════════════════════════════════════
// MEMORY STATS (for UI health bar)
// ═══════════════════════════════════════════════════

export interface MemoryStats {
    total: number
    active: number
    stale: number
    pinned: number
    by_type: Record<MemoryType, number>
    by_source: Record<MemorySource, number>
}

// ═══════════════════════════════════════════════════
// CATEGORY HELPERS
// ═══════════════════════════════════════════════════

/** Map memory type to display category */
export function getMemoryCategory(type: MemoryType): MemoryCategory {
    switch (type) {
        case 'preference':
        case 'correction':
            return 'personal'
        case 'fact':
        case 'decision':
        case 'risk':
        case 'obligation':
        case 'insight':
        case 'argument':
        case 'outcome':
        case 'procedure':
            return 'case'
        case 'pattern':
            return 'firm'
    }
}

/** Display labels for memory types */
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
    fact: 'Fact',
    decision: 'Decision',
    risk: 'Risk',
    obligation: 'Obligation',
    insight: 'Insight',
    preference: 'Preference',
    argument: 'Argument',
    outcome: 'Outcome',
    procedure: 'Procedure',
    pattern: 'Pattern',
    correction: 'Correction',
}

/** Color tokens for memory type badges (CSS variable names) */
export const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
    fact: '#3b82f6',        // blue
    decision: '#a855f7',    // purple
    risk: '#ef4444',        // red
    obligation: '#f59e0b',  // amber
    insight: '#06b6d4',     // cyan
    preference: '#10b981',  // emerald
    argument: '#f97316',    // orange
    outcome: '#8b5cf6',     // violet
    procedure: '#6366f1',   // indigo
    pattern: '#14b8a6',     // teal
    correction: '#64748b',  // slate
}
