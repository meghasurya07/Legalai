/**
 * Document Intelligence — Metadata Extraction
 * 
 * Extracts structured metadata (parties, dates, obligations, risks)
 * from legal document text using AI.
 */

import { callAI } from '@/lib/ai/client'
import { AI_MODELS, AI_TOKENS } from '@/lib/ai/config'
import { buildMetadataPrompt } from './prompts'
import type { Party, Obligation, Risk } from './types'

export interface ExtractedMetadata {
    parties: Party[]
    effectiveDate: string | null
    governingLaw: string | null
    terminationClause: string | null
    keyObligations: Obligation[]
    risks: Risk[]
}

/**
 * Extract structured metadata from document text.
 * Returns parsed metadata or defaults on failure.
 */
export async function extractMetadata(text: string): Promise<ExtractedMetadata> {
    const defaults: ExtractedMetadata = {
        parties: [],
        effectiveDate: null,
        governingLaw: null,
        terminationClause: null,
        keyObligations: [],
        risks: []
    }

    try {
        const { systemPrompt, userPrompt } = buildMetadataPrompt(text)

        const { result } = await callAI('doc_intel_metadata' as import('@/lib/ai/prompts').UseCase, {
            systemOverride: systemPrompt,
            userOverride: userPrompt,
            text
        }, {
            jsonMode: true,
            maxTokens: AI_TOKENS.docIntel.metadata,
            model: AI_MODELS.docIntel
        })

        const parsed = JSON.parse(result)

        return {
            parties: Array.isArray(parsed.parties) ? parsed.parties.map((p: Record<string, string>) => ({
                name: String(p.name || ''),
                role: String(p.role || '')
            })) : [],
            effectiveDate: parsed.effective_date || null,
            governingLaw: parsed.governing_law || null,
            terminationClause: parsed.termination_clause || null,
            keyObligations: Array.isArray(parsed.key_obligations) ? parsed.key_obligations.map((o: Record<string, string>) => ({
                party: String(o.party || ''),
                obligation: String(o.obligation || ''),
                deadline: o.deadline || undefined
            })) : [],
            risks: Array.isArray(parsed.risks) ? parsed.risks.map((r: Record<string, string>) => ({
                category: String(r.category || ''),
                description: String(r.description || ''),
                severity: (['high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium') as 'high' | 'medium' | 'low'
            })) : []
        }
    } catch (error) {
        console.error('[DocIntel] Metadata extraction failed:', error)
        return defaults
    }
}
