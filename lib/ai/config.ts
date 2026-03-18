/**
 * Centralized AI Configuration Module
 *
 * Single source of truth for all AI model names, token limits,
 * temperature presets, embedding parameters, and RAG tuning.
 *
 * To change a model or adjust token budgets across the entire app,
 * edit ONLY this file.
 */

// ═══════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════

export const AI_MODELS = {
    /** Main chat / assistant — standard responses */
    chat: 'gpt-4o-mini',
    /** Chat — web search mode (must support web_search tool) */
    chatWebSearch: 'gpt-4o-mini',
    /** Chat — thinking / reasoning mode (requires reasoning-capable model: o4-mini, o3, gpt-5) */
    chatThinking: 'o4-mini',
    /** Chat — deep research mode (requires verified org: o3-deep-research, o4-mini-deep-research) */
    chatDeepResearch: 'o4-mini-deep-research',
    /** Title generation — ultra-cheap model for generating short conversation titles */
    titleGeneration: 'gpt-4.1-nano',
    /** Document Intelligence — summaries, metadata, clause extraction */
    docIntel: 'gpt-4o-mini',
    /** Trust & Insight layer — conflicts, insights, project summaries */
    trust: 'gpt-4o-mini',
    /** Tabular Review — column suggestion & data extraction */
    tabularReview: 'gpt-4o-mini',
    /** Company research — web search for company profiles */
    companyResearch: 'gpt-4o-mini',
    /** Embedding model for RAG vector search */
    embedding: 'text-embedding-3-small',
} as const

export type AIModelKey = keyof typeof AI_MODELS

// ═══════════════════════════════════════════════════
// TEMPERATURE PRESETS
// ═══════════════════════════════════════════════════

export const AI_TEMPERATURES = {
    /** High-precision extraction & structured output */
    precise: 0.2,
    /** Balanced — search planning, synthesis */
    balanced: 0.3,
    /** Default conversational / analysis */
    default: 0.4,
} as const

export type AITemperaturePreset = keyof typeof AI_TEMPERATURES


// ═══════════════════════════════════════════════════
// TOKEN LIMITS — per feature area
// ═══════════════════════════════════════════════════

export const AI_TOKENS = {
    /** Default fallback for callAI when no maxTokens specified */
    default: 700,

    // ── Chat mode presets ──────────────────────────
    chat: {
        standard: 1500,
        webSearch: 1500,
        thinking: 4000,
        deepResearch: 8000,
    },

    // ── Trust & Insight layer ─────────────────────
    trust: 1500,

    // ── Document Intelligence ─────────────────────
    docIntel: {
        summary: 800,
        metadata: 1500,
        clauses: 2000,
    },

    // ── Tabular Review extraction ─────────────────
    tabularReview: {
        extract: 300,
        suggestColumns: 800,
        extractBatch: 1500,
    },
} as const

// ═══════════════════════════════════════════════════
// EMBEDDING CONFIGURATION
// ═══════════════════════════════════════════════════

export const EMBEDDING_CONFIG = {
    model: AI_MODELS.embedding,
    dimensions: 1536,
    batchSize: 100,
} as const

// ═══════════════════════════════════════════════════
// RAG TUNING PARAMETERS
// ═══════════════════════════════════════════════════

export const RAG_CONFIG = {
    chunking: {
        /** Minimum tokens for a valid chunk (~80 chars) */
        minTokens: 20,
        /** Maximum tokens per chunk */
        maxTokens: 700,
        /** Overlap between consecutive chunks (fraction) */
        overlapPercent: 0.12,
    },
    retrieval: {
        /** Top-K chunks to return */
        topK: 6,
        /** Maximum total context tokens injected into prompt */
        maxTokens: 3000,
        /** Max chunks from a single file (diversity enforcement) */
        maxChunksPerFile: 3,
    },
} as const

// ═══════════════════════════════════════════════════
// HELPER — Chat mode → config resolver
// ═══════════════════════════════════════════════════

export type ChatMode = 'standard' | 'webSearch' | 'thinking' | 'deepResearch'

interface ChatConfig {
    model: string
    maxTokens: number
    temperature: number
}

/** Maps each chat mode to its model key in AI_MODELS */
const CHAT_MODE_MODEL_MAP: Record<ChatMode, keyof typeof AI_MODELS> = {
    standard: 'chat',
    webSearch: 'chatWebSearch',
    thinking: 'chatThinking',
    deepResearch: 'chatDeepResearch',
}

/**
 * Returns the correct model, maxTokens, and temperature for a given chat mode.
 */
export function getChatConfig(mode: ChatMode): ChatConfig {
    return {
        model: AI_MODELS[CHAT_MODE_MODEL_MAP[mode]],
        maxTokens: AI_TOKENS.chat[mode],
        temperature: AI_TEMPERATURES.default,
    }
}
