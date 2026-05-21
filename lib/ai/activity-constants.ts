/**
 * Wesley AI Activity Constants
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized activity phase definitions, legal-domain rotating verbs, and
 * phase configuration for the AI activity timeline.
 *
 * Architecture inspired by Claude Code's spinnerVerbs.ts pattern (187 rotating
 * gerund verbs), adapted for the legal domain with Harvey/Legora-grade
 * specificity.
 */

// ─── Expanded Activity Phase Type ────────────────────────────────────────────
// From ~12 generic phases → 25+ granular legal AI lifecycle phases.

export type ActivityPhase =
    | 'initializing'
    | 'analyzing_query'
    | 'planning_research'
    | 'searching_web'
    | 'reading_sources'
    | 'extracting_information'
    | 'analyzing_documents'
    | 'cross_referencing'
    | 'validating_citations'
    | 'reviewing_precedent'
    | 'checking_compliance'
    | 'synthesizing'
    | 'drafting_response'
    | 'reviewing_output'
    // Legacy aliases (backward compat with existing server events)
    | 'research_planning'
    | 'source_collection'
    | 'reading_extraction'
    | 'comparing'
    | 'synthesis'
    | 'thinking'
    | 'drafting'
    | 'writing'
    | 'complete'
    | 'error'
    | null

// ─── Phase Category ──────────────────────────────────────────────────────────

export type PhaseCategory =
    | 'initialization'
    | 'analysis'
    | 'research'
    | 'extraction'
    | 'validation'
    | 'synthesis'
    | 'drafting'
    | 'completion'
    | 'error'

// ─── Phase Configuration ─────────────────────────────────────────────────────

export interface PhaseConfig {
    label: string
    description: string
    icon: string       // Lucide icon name
    category: PhaseCategory
    verbs: string[]    // Phase-specific rotating verbs
}

export const ACTIVITY_PHASE_CONFIG: Record<string, PhaseConfig> = {
    // ── Initialization ──
    initializing: {
        label: 'Initializing',
        description: 'Preparing the analysis environment',
        icon: 'Loader2',
        category: 'initialization',
        verbs: ['Preparing workspace', 'Loading context', 'Setting up analysis'],
    },
    analyzing_query: {
        label: 'Analyzing Query',
        description: 'Understanding the legal question and intent',
        icon: 'Brain',
        category: 'analysis',
        verbs: [
            'Parsing legal question', 'Identifying key issues',
            'Determining scope of inquiry', 'Classifying matter type',
        ],
    },

    // ── Research ──
    planning_research: {
        label: 'Planning Research',
        description: 'Determining research strategy and sources',
        icon: 'Map',
        category: 'research',
        verbs: [
            'Mapping research strategy', 'Identifying relevant authorities',
            'Scoping jurisdictional boundaries', 'Outlining research plan',
        ],
    },
    research_planning: {
        label: 'Planning Research',
        description: 'Determining research strategy and sources',
        icon: 'Map',
        category: 'research',
        verbs: [
            'Mapping research strategy', 'Identifying relevant authorities',
            'Scoping jurisdictional boundaries', 'Outlining research plan',
        ],
    },
    searching_web: {
        label: 'Searching Sources',
        description: 'Searching across legal databases and the web',
        icon: 'Globe',
        category: 'research',
        verbs: [
            'Searching legal databases', 'Querying case repositories',
            'Scanning regulatory filings', 'Surveying legal authorities',
            'Canvassing judicial opinions', 'Scouring statute compilations',
        ],
    },
    source_collection: {
        label: 'Collecting Sources',
        description: 'Gathering relevant legal materials',
        icon: 'FolderSearch',
        category: 'research',
        verbs: [
            'Gathering legal materials', 'Collecting relevant authorities',
            'Assembling source documents', 'Compiling research corpus',
        ],
    },

    // ── Reading & Extraction ──
    reading_sources: {
        label: 'Reading Sources',
        description: 'Processing and understanding gathered materials',
        icon: 'BookOpen',
        category: 'extraction',
        verbs: [
            'Reading case opinions', 'Reviewing statutory text',
            'Studying regulatory guidance', 'Examining source materials',
            'Perusing legal commentary', 'Digesting judicial holdings',
        ],
    },
    extracting_information: {
        label: 'Extracting Information',
        description: 'Pulling key facts and holdings from sources',
        icon: 'ScanSearch',
        category: 'extraction',
        verbs: [
            'Extracting key holdings', 'Isolating material facts',
            'Identifying operative provisions', 'Pulling critical data points',
        ],
    },
    reading_extraction: {
        label: 'Reading & Extracting',
        description: 'Parsing and extracting relevant content',
        icon: 'ScanSearch',
        category: 'extraction',
        verbs: [
            'Extracting key provisions', 'Parsing document structure',
            'Isolating relevant clauses', 'Identifying core terms',
        ],
    },

    // ── Analysis ──
    analyzing_documents: {
        label: 'Analyzing Documents',
        description: 'Deep analysis of document content and structure',
        icon: 'FileSearch',
        category: 'analysis',
        verbs: [
            'Analyzing document structure', 'Reviewing contractual language',
            'Examining clause interactions', 'Parsing defined terms',
            'Assessing document hierarchy', 'Evaluating provision scope',
        ],
    },
    cross_referencing: {
        label: 'Cross-Referencing',
        description: 'Comparing across multiple sources and authorities',
        icon: 'GitCompare',
        category: 'analysis',
        verbs: [
            'Cross-referencing authorities', 'Comparing judicial holdings',
            'Reconciling conflicting provisions', 'Matching precedent patterns',
            'Triangulating source materials', 'Correlating regulatory guidance',
        ],
    },
    comparing: {
        label: 'Comparing Sources',
        description: 'Comparing information across sources',
        icon: 'Scale',
        category: 'analysis',
        verbs: [
            'Comparing legal positions', 'Weighing competing authorities',
            'Evaluating relative strength', 'Assessing doctrinal consistency',
        ],
    },

    // ── Validation ──
    validating_citations: {
        label: 'Validating Citations',
        description: 'Verifying accuracy and currency of cited authorities',
        icon: 'ShieldCheck',
        category: 'validation',
        verbs: [
            'Validating citation accuracy', 'Checking case currency',
            'Confirming statutory authority', 'Verifying precedent status',
        ],
    },
    reviewing_precedent: {
        label: 'Reviewing Precedent',
        description: 'Analyzing applicable case law and judicial holdings',
        icon: 'Gavel',
        category: 'validation',
        verbs: [
            'Reviewing applicable precedent', 'Analyzing judicial holdings',
            'Assessing binding authority', 'Evaluating persuasive precedent',
        ],
    },
    checking_compliance: {
        label: 'Checking Compliance',
        description: 'Verifying regulatory and jurisdictional compliance',
        icon: 'ClipboardCheck',
        category: 'validation',
        verbs: [
            'Verifying regulatory compliance', 'Checking jurisdictional rules',
            'Confirming procedural requirements', 'Assessing filing obligations',
        ],
    },

    // ── Synthesis ──
    synthesizing: {
        label: 'Synthesizing',
        description: 'Consolidating analysis into coherent findings',
        icon: 'Wand2',
        category: 'synthesis',
        verbs: [
            'Synthesizing findings', 'Consolidating analysis',
            'Integrating source materials', 'Reconciling authorities',
            'Distilling legal principles', 'Formulating conclusions',
        ],
    },
    synthesis: {
        label: 'Synthesizing',
        description: 'Building final analysis from gathered data',
        icon: 'Wand2',
        category: 'synthesis',
        verbs: [
            'Synthesizing research', 'Merging analytical threads',
            'Constructing legal framework', 'Weaving analysis together',
        ],
    },

    // ── Thinking (generic reasoning) ──
    thinking: {
        label: 'Reasoning',
        description: 'Applying legal reasoning to the problem',
        icon: 'Brain',
        category: 'analysis',
        verbs: [
            'Reasoning through the problem', 'Applying legal analysis',
            'Deliberating on approach', 'Considering implications',
            'Evaluating legal framework', 'Weighing factors',
            'Contemplating arguments', 'Cogitating on the matter',
        ],
    },

    // ── Drafting ──
    drafting_response: {
        label: 'Drafting Response',
        description: 'Composing the final legal analysis or document',
        icon: 'PenLine',
        category: 'drafting',
        verbs: [
            'Drafting legal analysis', 'Composing response',
            'Structuring arguments', 'Formulating recommendations',
            'Writing legal memorandum', 'Preparing advisory',
        ],
    },
    drafting: {
        label: 'Drafting',
        description: 'Writing the response',
        icon: 'PenLine',
        category: 'drafting',
        verbs: [
            'Drafting provisions', 'Composing language',
            'Formulating arguments', 'Structuring clauses',
        ],
    },
    writing: {
        label: 'Writing',
        description: 'Generating the final output',
        icon: 'Sparkles',
        category: 'drafting',
        verbs: [
            'Writing response', 'Generating output',
            'Articulating analysis', 'Producing deliverable',
        ],
    },
    reviewing_output: {
        label: 'Reviewing Output',
        description: 'Final quality check before delivery',
        icon: 'CheckCircle',
        category: 'drafting',
        verbs: [
            'Reviewing final output', 'Quality checking analysis',
            'Polishing language', 'Ensuring completeness',
        ],
    },

    // ── Completion / Error ──
    complete: {
        label: 'Complete',
        description: 'Analysis finished',
        icon: 'CheckCircle2',
        category: 'completion',
        verbs: [],
    },
    error: {
        label: 'Error',
        description: 'An error occurred during processing',
        icon: 'AlertTriangle',
        category: 'error',
        verbs: [],
    },
}

// ─── Legal Domain Rotating Verbs ─────────────────────────────────────────────
// Comprehensive list of legal-specific activity verbs (gerund form).
// Inspired by Claude Code's 187-verb architecture, curated for legal AI.

export const LEGAL_ACTIVITY_VERBS: string[] = [
    // ── Analysis & Review ──
    'Analyzing jurisdiction',
    'Reviewing precedent',
    'Examining statutory framework',
    'Parsing contractual language',
    'Evaluating legal positions',
    'Assessing risk factors',
    'Scrutinizing provisions',
    'Interpreting regulatory text',
    'Deconstructing arguments',
    'Appraising legal standing',

    // ── Research & Discovery ──
    'Researching case law',
    'Cross-referencing regulations',
    'Surveying legal authorities',
    'Canvassing judicial opinions',
    'Investigating statutory history',
    'Tracing legislative intent',
    'Mapping doctrinal landscape',
    'Exploring precedent chains',
    'Unearthing relevant rulings',
    'Scouring regulatory archives',

    // ── Document Work ──
    'Drafting provisions',
    'Formulating arguments',
    'Structuring clauses',
    'Composing legal memorandum',
    'Preparing advisory opinion',
    'Articulating legal position',
    'Constructing brief',
    'Outlining counterarguments',
    'Redlining contract terms',
    'Annotating key passages',

    // ── Validation & Compliance ──
    'Validating citations',
    'Verifying compliance',
    'Checking jurisdictional applicability',
    'Confirming statutory authority',
    'Authenticating source materials',
    'Corroborating holdings',
    'Substantiating legal basis',
    'Benchmarking against standards',
    'Auditing regulatory alignment',
    'Stress-testing arguments',

    // ── Synthesis & Integration ──
    'Synthesizing findings',
    'Consolidating analysis',
    'Reconciling authorities',
    'Integrating source materials',
    'Distilling legal principles',
    'Harmonizing interpretations',
    'Weaving analytical threads',
    'Unifying legal framework',
    'Crystallizing conclusions',
    'Converging on analysis',

    // ── General AI Reasoning (from Claude Code pattern) ──
    'Reasoning',
    'Deliberating',
    'Cogitating',
    'Contemplating',
    'Processing',
    'Computing',
    'Inferring',
    'Orchestrating',
    'Calibrating',
    'Iterating',
    'Extrapolating',
    'Interpolating',
    'Optimizing',
    'Refining',
    'Triangulating',
]

// ─── Verb Selection ──────────────────────────────────────────────────────────

/**
 * Get a random contextually-appropriate verb for the current phase.
 * Uses phase-specific verbs when available, falls back to the general pool.
 */
export function getRandomVerb(phase: ActivityPhase): string {
    if (!phase) return 'Processing'

    const config = ACTIVITY_PHASE_CONFIG[phase]
    if (config && config.verbs.length > 0) {
        return config.verbs[Math.floor(Math.random() * config.verbs.length)]
    }

    // Fallback to general legal verb pool
    return LEGAL_ACTIVITY_VERBS[Math.floor(Math.random() * LEGAL_ACTIVITY_VERBS.length)]
}

/**
 * Get the display label for a phase.
 */
export function getPhaseLabel(phase: string): string {
    return ACTIVITY_PHASE_CONFIG[phase]?.label || phase.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Get the icon name for a phase.
 */
export function getPhaseIcon(phase: string): string {
    return ACTIVITY_PHASE_CONFIG[phase]?.icon || 'Brain'
}

/**
 * Get the category for a phase.
 */
export function getPhaseCategory(phase: string): PhaseCategory {
    return ACTIVITY_PHASE_CONFIG[phase]?.category || 'analysis'
}
