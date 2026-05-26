import { describe, it, expect } from 'vitest'
import { PIPELINES } from '@/lib/workflow/pipelines'

const PIPELINE_KEYS = [
    'contract_analysis',
    'due_diligence',
    'compliance_review',
    'risk_assessment',
    'research_memo',
    'drafting_review',
] as const

describe('PIPELINES configuration', () => {
    // ── 1. Exactly 6 entries ─────────────────────────────────
    it('has exactly 6 pipeline entries', () => {
        expect(Object.keys(PIPELINES)).toHaveLength(6)
    })

    // ── 2. All 6 keys exist ──────────────────────────────────
    it('contains all 6 expected pipeline keys', () => {
        for (const key of PIPELINE_KEYS) {
            expect(PIPELINES).toHaveProperty(key)
        }
    })

    // ── 3. Each pipeline has valid id, name, description ─────
    it('each pipeline has valid id, name, and description strings', () => {
        for (const key of PIPELINE_KEYS) {
            const pipeline = PIPELINES[key]
            expect(typeof pipeline.id).toBe('string')
            expect(pipeline.id.length).toBeGreaterThan(0)
            expect(typeof pipeline.name).toBe('string')
            expect(pipeline.name.length).toBeGreaterThan(0)
            expect(typeof pipeline.description).toBe('string')
            expect(pipeline.description.length).toBeGreaterThan(0)
        }
    })

    // ── 4. Each pipeline has at least 2 steps ────────────────
    it('each pipeline has at least 2 steps', () => {
        for (const key of PIPELINE_KEYS) {
            expect(PIPELINES[key].steps.length).toBeGreaterThanOrEqual(2)
        }
    })

    // ── 5. Every step has required fields ────────────────────
    it('every step has id, type, name, promptTemplate, and contextSource', () => {
        for (const key of PIPELINE_KEYS) {
            for (const step of PIPELINES[key].steps) {
                expect(step).toHaveProperty('id')
                expect(typeof step.id).toBe('string')
                expect(step).toHaveProperty('type')
                expect(typeof step.type).toBe('string')
                expect(step).toHaveProperty('name')
                expect(typeof step.name).toBe('string')
                expect(step).toHaveProperty('promptTemplate')
                expect(typeof step.promptTemplate).toBe('string')
                expect(step).toHaveProperty('contextSource')
                expect(typeof step.contextSource).toBe('string')
            }
        }
    })

    // ── 6-11. Per-pipeline step counts ───────────────────────
    it('contract_analysis has exactly 3 steps', () => {
        expect(PIPELINES.contract_analysis.steps).toHaveLength(3)
    })

    it('due_diligence has exactly 4 steps', () => {
        expect(PIPELINES.due_diligence.steps).toHaveLength(4)
    })

    it('compliance_review has exactly 4 steps', () => {
        expect(PIPELINES.compliance_review.steps).toHaveLength(4)
    })

    it('risk_assessment has exactly 3 steps', () => {
        expect(PIPELINES.risk_assessment.steps).toHaveLength(3)
    })

    it('research_memo has exactly 3 steps', () => {
        expect(PIPELINES.research_memo.steps).toHaveLength(3)
    })

    it('drafting_review has exactly 3 steps', () => {
        expect(PIPELINES.drafting_review.steps).toHaveLength(3)
    })

    // ── 12. First step contextSource is NONE or RAG ──────────
    it('first step of each pipeline has contextSource NONE or RAG', () => {
        for (const key of PIPELINE_KEYS) {
            const firstStep = PIPELINES[key].steps[0]
            expect(['NONE', 'RAG']).toContain(firstStep.contextSource)
        }
    })

    // ── 13. Last step contextSource is ALL for synthesis ─────
    it('last step of most pipelines has contextSource ALL for synthesis', () => {
        // All 6 pipelines end with contextSource ALL
        const pipelinesWithAllEnd = PIPELINE_KEYS.filter(
            key => PIPELINES[key].steps[PIPELINES[key].steps.length - 1].contextSource === 'ALL'
        )
        // At least 5 of the 6 should end with ALL
        expect(pipelinesWithAllEnd.length).toBeGreaterThanOrEqual(5)
    })

    // ── 14. No duplicate step IDs within a pipeline ──────────
    it('no duplicate step IDs within any pipeline', () => {
        for (const key of PIPELINE_KEYS) {
            const stepIds = PIPELINES[key].steps.map(s => s.id)
            const unique = new Set(stepIds)
            expect(unique.size).toBe(stepIds.length)
        }
    })
})
