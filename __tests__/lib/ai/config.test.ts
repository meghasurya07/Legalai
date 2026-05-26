import { describe, it, expect } from 'vitest'
import {
    AI_MODELS,
    EMBEDDING_CONFIG,
    AI_TEMPERATURES,
    AI_TOKENS,
    RAG_CONFIG,
} from '@/lib/ai/config'

describe('AI_MODELS', () => {
    // ── 1. At least 15 distinct model keys ───────────────────
    it('has at least 15 distinct model keys', () => {
        const keys = Object.keys(AI_MODELS)
        expect(keys.length).toBeGreaterThanOrEqual(15)
    })

    // ── 2. Every model key has a non-empty default string value
    it('every model key has a non-empty default string value', () => {
        for (const [key, value] of Object.entries(AI_MODELS)) {
            expect(value, `AI_MODELS.${key} should be non-empty`).toBeTruthy()
            expect((value as string).length).toBeGreaterThan(0)
        }
    })

    // ── 3. Every model value is a string ─────────────────────
    it('every model key has a string value (type check)', () => {
        for (const [key, value] of Object.entries(AI_MODELS)) {
            expect(typeof value, `AI_MODELS.${key} should be a string`).toBe('string')
        }
    })
})

describe('EMBEDDING_CONFIG', () => {
    // ── 4. Has required fields ───────────────────────────────
    it('has model, dimensions, and batchSize fields', () => {
        expect(EMBEDDING_CONFIG).toHaveProperty('model')
        expect(EMBEDDING_CONFIG).toHaveProperty('dimensions')
        expect(EMBEDDING_CONFIG).toHaveProperty('batchSize')
    })

    // ── 5. Dimensions is 3072 ────────────────────────────────
    it('dimensions defaults to 3072', () => {
        expect(EMBEDDING_CONFIG.dimensions).toBe(3072)
    })
})

describe('AI_TEMPERATURES', () => {
    // ── 6. Has all four preset keys ──────────────────────────
    it('has creative, balanced, precise, and default temperature values', () => {
        expect(AI_TEMPERATURES).toHaveProperty('creative')
        expect(AI_TEMPERATURES).toHaveProperty('balanced')
        expect(AI_TEMPERATURES).toHaveProperty('precise')
        expect(AI_TEMPERATURES).toHaveProperty('default')
    })

    // ── 7. Precise is 0.1 ────────────────────────────────────
    it('precise temperature is 0.1', () => {
        expect(AI_TEMPERATURES.precise).toBe(0.1)
    })

    // ── 8. Creative is 0.7 ───────────────────────────────────
    it('creative temperature is 0.7', () => {
        expect(AI_TEMPERATURES.creative).toBe(0.7)
    })
})

describe('AI_TOKENS', () => {
    // ── 9. Has docIntel sub-object ───────────────────────────
    it('has a docIntel sub-object', () => {
        expect(AI_TOKENS).toHaveProperty('docIntel')
        expect(typeof AI_TOKENS.docIntel).toBe('object')
    })

    // ── 10. docIntel has summary, metadata, clauses ──────────
    it('docIntel has summary, metadata, and clauses token limits', () => {
        expect(AI_TOKENS.docIntel).toHaveProperty('summary')
        expect(AI_TOKENS.docIntel).toHaveProperty('metadata')
        expect(AI_TOKENS.docIntel).toHaveProperty('clauses')
    })

    // ── 11. All token limits are positive numbers ────────────
    it('all token limits are positive numbers', () => {
        function assertPositiveTokens(obj: Record<string, unknown>, path: string) {
            for (const [key, value] of Object.entries(obj)) {
                const fullPath = `${path}.${key}`
                if (typeof value === 'number') {
                    expect(value, `${fullPath} should be positive`).toBeGreaterThan(0)
                } else if (typeof value === 'object' && value !== null) {
                    assertPositiveTokens(value as Record<string, unknown>, fullPath)
                }
            }
        }
        assertPositiveTokens(AI_TOKENS as unknown as Record<string, unknown>, 'AI_TOKENS')
    })
})

describe('RAG_CONFIG', () => {
    // ── 12. Has chunking and retrieval sections ──────────────
    it('has chunking and retrieval sections', () => {
        expect(RAG_CONFIG).toHaveProperty('chunking')
        expect(RAG_CONFIG).toHaveProperty('retrieval')
        expect(typeof RAG_CONFIG.chunking).toBe('object')
        expect(typeof RAG_CONFIG.retrieval).toBe('object')
    })
})
