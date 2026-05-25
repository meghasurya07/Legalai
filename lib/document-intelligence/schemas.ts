import { z } from 'zod'

export const SummarySchema = z.object({
    summary: z.string().min(10)
})

export const PartySchema = z.object({
    name: z.string(),
    role: z.string(),
    confidence: z.number().min(0).max(1).optional()
})

export const ObligationSchema = z.object({
    party: z.string(),
    obligation: z.string(),
    deadline: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).optional()
})

export const RiskSchema = z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    confidence: z.number().min(0).max(1).optional()
})

export const MetadataSchema = z.object({
    parties: z.array(PartySchema).default([]),
    effective_date: z.string().nullable().optional(),
    governing_law: z.string().nullable().optional(),
    termination_clause: z.string().nullable().optional(),
    key_obligations: z.array(ObligationSchema).default([]),
    risks: z.array(RiskSchema).default([])
})

export const ClauseSchema = z.object({
    clause_type: z.string(),
    section_title: z.string().nullable().optional(),
    section_number: z.string().nullable().optional(),
    text: z.string(),
    confidence: z.number().min(0).max(1).optional()
})

export const ClausesResponseSchema = z.object({
    clauses: z.array(ClauseSchema).default([])
})
