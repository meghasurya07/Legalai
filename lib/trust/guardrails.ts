/**
 * Trust & Insight Layer — Hallucination Guardrails
 * 
 * Validates AI responses against the provided context
 * to flag unsupported claims.
 */

import type { GuardrailResult } from './types'

/**
 * Validate that an AI response is grounded in the provided context.
 * Performs lightweight heuristic checks — not an AI re-check.
 */
export function validateResponse(
    response: string,
    contextSnippets: string[]
): GuardrailResult {
    const warnings: string[] = []

    if (!response || response.length < 10) {
        return { valid: true, warnings: [] }
    }

    // 1. Check for fabrication indicators
    const fabricationPatterns = [
        /according to.*(?:article|section)\s+\d+.*of the.*(?:act|code|statute)/i,
        /as stated in.*(?:case|ruling)\s+.+v\.\s+/i,
        /under.*(?:regulation|directive)\s+\d+\/\d+/i,
    ]

    for (const pattern of fabricationPatterns) {
        if (pattern.test(response)) {
            // Check if any context snippet supports this claim
            const claim = response.match(pattern)?.[0] || ''
            const supported = contextSnippets.some(s =>
                s.toLowerCase().includes(claim.toLowerCase().slice(0, 30))
            )
            if (!supported) {
                warnings.push(`Possible unsupported legal reference: "${claim.slice(0, 80)}"`)
            }
        }
    }

    // 2. Check for citation usage (good sign)
    const citationCount = (response.match(/\[\d+\]/g) || []).length
    const claimSentences = response.split(/[.!?]/).filter(s => s.trim().length > 30).length

    if (claimSentences > 3 && citationCount === 0 && contextSnippets.length > 0) {
        warnings.push('Response makes multiple claims without any inline citations [N]')
    }

    // 3. Check for hedge language when context is thin
    if (contextSnippets.length === 0 || contextSnippets.every(s => s.length < 30)) {
        if (!/(?:insufficient|not contain|no relevant|cannot determine)/i.test(response)) {
            warnings.push('Response generated with minimal context but lacks uncertainty disclosure')
        }
    }

    return {
        valid: warnings.length === 0,
        warnings
    }
}
