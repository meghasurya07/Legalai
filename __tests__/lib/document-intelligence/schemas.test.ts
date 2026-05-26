import { describe, it, expect } from 'vitest'
import {
    SummarySchema,
    PartySchema,
    ObligationSchema,
    RiskSchema,
    MetadataSchema,
    ClauseSchema,
    ClausesResponseSchema
} from '@/lib/document-intelligence/schemas'

// ---------------------------------------------------------------------------
// 1. SummarySchema
// ---------------------------------------------------------------------------
describe('SummarySchema', () => {
    it('accepts a valid summary with 10+ characters', () => {
        const result = SummarySchema.safeParse({ summary: 'This is a valid summary of the document.' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.summary).toBe('This is a valid summary of the document.')
        }
    })

    it('accepts a summary with exactly 10 characters', () => {
        const result = SummarySchema.safeParse({ summary: '1234567890' })
        expect(result.success).toBe(true)
    })

    it('rejects an empty string', () => {
        const result = SummarySchema.safeParse({ summary: '' })
        expect(result.success).toBe(false)
    })

    it('rejects a short string with fewer than 10 characters', () => {
        const result = SummarySchema.safeParse({ summary: 'Too short' }) // 9 chars
        expect(result.success).toBe(false)
    })

    it('rejects when summary field is missing entirely', () => {
        const result = SummarySchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// 2. PartySchema
// ---------------------------------------------------------------------------
describe('PartySchema', () => {
    it('accepts name and role with no confidence', () => {
        const result = PartySchema.safeParse({ name: 'Acme Corp', role: 'Vendor' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.name).toBe('Acme Corp')
            expect(result.data.role).toBe('Vendor')
            expect(result.data.confidence).toBeUndefined()
        }
    })

    it('accepts confidence at lower bound (0)', () => {
        const result = PartySchema.safeParse({ name: 'X', role: 'Y', confidence: 0 })
        expect(result.success).toBe(true)
    })

    it('accepts confidence at upper bound (1)', () => {
        const result = PartySchema.safeParse({ name: 'X', role: 'Y', confidence: 1 })
        expect(result.success).toBe(true)
    })

    it('accepts confidence at 0.5', () => {
        const result = PartySchema.safeParse({ name: 'X', role: 'Y', confidence: 0.5 })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.confidence).toBe(0.5)
    })

    it('rejects confidence greater than 1', () => {
        const result = PartySchema.safeParse({ name: 'X', role: 'Y', confidence: 1.01 })
        expect(result.success).toBe(false)
    })

    it('rejects negative confidence', () => {
        const result = PartySchema.safeParse({ name: 'X', role: 'Y', confidence: -0.1 })
        expect(result.success).toBe(false)
    })

    it('rejects when name is missing', () => {
        const result = PartySchema.safeParse({ role: 'Vendor' })
        expect(result.success).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// 3. ObligationSchema
// ---------------------------------------------------------------------------
describe('ObligationSchema', () => {
    it('accepts party and obligation with no optional fields', () => {
        const result = ObligationSchema.safeParse({
            party: 'Acme Corp',
            obligation: 'Deliver goods within 30 days'
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.deadline).toBeUndefined()
            expect(result.data.confidence).toBeUndefined()
        }
    })

    it('accepts with deadline and confidence', () => {
        const result = ObligationSchema.safeParse({
            party: 'Acme Corp',
            obligation: 'Pay invoice',
            deadline: '2025-12-31',
            confidence: 0.95
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.deadline).toBe('2025-12-31')
            expect(result.data.confidence).toBe(0.95)
        }
    })

    it('accepts null deadline', () => {
        const result = ObligationSchema.safeParse({
            party: 'X',
            obligation: 'Do something',
            deadline: null
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.deadline).toBeNull()
    })

    it('rejects when obligation field is missing', () => {
        const result = ObligationSchema.safeParse({ party: 'X' })
        expect(result.success).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// 4. RiskSchema
// ---------------------------------------------------------------------------
describe('RiskSchema', () => {
    it.each(['high', 'medium', 'low'] as const)('accepts severity "%s"', (severity) => {
        const result = RiskSchema.safeParse({
            category: 'Financial',
            description: 'Some risk',
            severity
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid severity value', () => {
        const result = RiskSchema.safeParse({
            category: 'Financial',
            description: 'Some risk',
            severity: 'critical'
        })
        expect(result.success).toBe(false)
    })

    it('rejects when severity is missing', () => {
        const result = RiskSchema.safeParse({
            category: 'Financial',
            description: 'Some risk'
        })
        expect(result.success).toBe(false)
    })

    it('accepts optional confidence within range', () => {
        const result = RiskSchema.safeParse({
            category: 'Financial',
            description: 'Some risk',
            severity: 'high',
            confidence: 0.8
        })
        expect(result.success).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// 5. MetadataSchema
// ---------------------------------------------------------------------------
describe('MetadataSchema', () => {
    it('defaults parties, key_obligations, and risks to empty arrays when missing', () => {
        const result = MetadataSchema.safeParse({})
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.parties).toEqual([])
            expect(result.data.key_obligations).toEqual([])
            expect(result.data.risks).toEqual([])
        }
    })

    it('parses a full metadata payload with all fields', () => {
        const input = {
            parties: [{ name: 'Alpha LLC', role: 'Lessor', confidence: 0.9 }],
            effective_date: '2025-01-01',
            governing_law: 'State of Delaware',
            termination_clause: 'Either party may terminate with 30 days notice.',
            key_obligations: [{
                party: 'Alpha LLC',
                obligation: 'Maintain premises',
                deadline: '2025-06-30',
                confidence: 0.85
            }],
            risks: [{
                category: 'Regulatory',
                description: 'Potential non-compliance with local ordinances',
                severity: 'medium' as const,
                confidence: 0.7
            }]
        }
        const result = MetadataSchema.safeParse(input)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.parties).toHaveLength(1)
            expect(result.data.effective_date).toBe('2025-01-01')
            expect(result.data.risks[0].severity).toBe('medium')
        }
    })

    it('accepts null for optional nullable string fields', () => {
        const result = MetadataSchema.safeParse({
            effective_date: null,
            governing_law: null,
            termination_clause: null
        })
        expect(result.success).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// 6. ClauseSchema
// ---------------------------------------------------------------------------
describe('ClauseSchema', () => {
    it('accepts clause_type and text with no optionals', () => {
        const result = ClauseSchema.safeParse({
            clause_type: 'indemnity',
            text: 'The Vendor shall indemnify the Client against all claims.'
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.section_title).toBeUndefined()
            expect(result.data.section_number).toBeUndefined()
        }
    })

    it('accepts optional section_title and section_number', () => {
        const result = ClauseSchema.safeParse({
            clause_type: 'termination',
            text: 'Either party may terminate…',
            section_title: 'Termination Rights',
            section_number: '14.2'
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.section_title).toBe('Termination Rights')
            expect(result.data.section_number).toBe('14.2')
        }
    })

    it('rejects when text is missing', () => {
        const result = ClauseSchema.safeParse({ clause_type: 'indemnity' })
        expect(result.success).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// 7. ClausesResponseSchema
// ---------------------------------------------------------------------------
describe('ClausesResponseSchema', () => {
    it('wraps an array of clauses', () => {
        const result = ClausesResponseSchema.safeParse({
            clauses: [{
                clause_type: 'confidentiality',
                text: 'All information disclosed shall remain confidential.'
            }]
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.clauses).toHaveLength(1)
        }
    })

    it('defaults clauses to an empty array when field is missing', () => {
        const result = ClausesResponseSchema.safeParse({})
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.clauses).toEqual([])
        }
    })
})

// ---------------------------------------------------------------------------
// 8. Real-world legal document metadata validation
// ---------------------------------------------------------------------------
describe('Real-world legal document metadata', () => {
    it('parses a realistic commercial lease metadata payload', () => {
        const realisticMetadata = {
            parties: [
                { name: 'Greenfield Properties LLC', role: 'Landlord', confidence: 0.97 },
                { name: 'ByteWave Technologies Inc.', role: 'Tenant', confidence: 0.95 }
            ],
            effective_date: '2025-03-15',
            governing_law: 'State of California',
            termination_clause: 'Either party may terminate this Lease upon 90 days\' prior written notice delivered to the other party at the address set forth herein.',
            key_obligations: [
                {
                    party: 'ByteWave Technologies Inc.',
                    obligation: 'Pay monthly rent of $12,500 on or before the first business day of each calendar month.',
                    deadline: '1st of each month',
                    confidence: 0.92
                },
                {
                    party: 'Greenfield Properties LLC',
                    obligation: 'Maintain structural integrity of the building, including roof, foundation, and exterior walls.',
                    deadline: null,
                    confidence: 0.88
                }
            ],
            risks: [
                {
                    category: 'Financial',
                    description: 'Tenant bears responsibility for all interior repairs exceeding $500, which could lead to unexpected capital expenditure.',
                    severity: 'medium' as const,
                    confidence: 0.82
                },
                {
                    category: 'Legal',
                    description: 'Non-compete clause restricts tenant from subleasing to competitors within a 5-mile radius, limiting flexibility.',
                    severity: 'high' as const,
                    confidence: 0.76
                }
            ]
        }

        const result = MetadataSchema.safeParse(realisticMetadata)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.parties).toHaveLength(2)
            expect(result.data.key_obligations).toHaveLength(2)
            expect(result.data.risks).toHaveLength(2)
            expect(result.data.governing_law).toBe('State of California')
            expect(result.data.risks[0].severity).toBe('medium')
            expect(result.data.risks[1].severity).toBe('high')
            expect(result.data.key_obligations[1].deadline).toBeNull()
        }
    })
})
