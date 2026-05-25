/**
 * Trust — AI-Powered Claim Verification (H29) + Confidence Scoring (H30)
 * 
 * Decomposes AI responses into individual claims, then verifies each claim
 * against RAG source chunks. Provides per-claim confidence scores.
 * 
 * This is the foundation of Harvey-style multi-layered verification:
 * 1. Decompose response into atomic claims
 * 2. Check each claim against source evidence
 * 3. Score confidence per claim
 * 4. Return overall confidence score
 */

import { callAI } from '@/lib/ai/client'
import { parseAIJSON } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import type { UseCase } from '@/lib/ai/prompts'

export type ClaimVerificationStatus = 'verified' | 'unverified' | 'contradicted'

export interface VerifiedClaim {
    /** The claim text extracted from the AI response */
    claim: string
    /** Verification status */
    status: ClaimVerificationStatus
    /** Confidence score 0.0-1.0 */
    confidence: number
    /** Index of supporting source chunk (if verified), or contradicting chunk (if contradicted) */
    sourceChunkIndex?: number
    /** Brief explanation of verification result */
    reasoning?: string
}

export interface VerificationResult {
    claims: VerifiedClaim[]
    overallConfidence: number
    verifiedCount: number
    unverifiedCount: number
    contradictedCount: number
}

/**
 * Verify claims in an AI response against RAG source chunks.
 * 
 * Uses a single AI call to decompose + verify all claims (efficient).
 * Returns per-claim verification status and confidence scores.
 */
export async function verifyClaims(
    responseText: string,
    ragChunks: Array<{ content: string; fileName?: string; chunkIndex?: number }>
): Promise<VerificationResult> {
    const emptyResult: VerificationResult = {
        claims: [],
        overallConfidence: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        contradictedCount: 0,
    }

    try {
        if (!responseText || responseText.length < 20 || ragChunks.length === 0) {
            return emptyResult
        }

        // Format source chunks for the verification prompt
        const sourcesText = ragChunks
            .map((chunk, idx) => `[Source ${idx + 1}]: ${chunk.content.slice(0, 600)}`)
            .join('\n\n')

        const { result } = await callAI('claim_verification' as UseCase, {
            text: responseText,
        }, {
            jsonMode: true,
            maxTokens: 2000,
            temperature: 0.1,
            systemOverride: `You are a legal fact-checking system. Your job is to:
1. Decompose the AI response into individual factual claims (each claim should be a single verifiable statement)
2. For each claim, check if it is supported by the provided source documents
3. Assign a verification status and confidence score

Rules:
- Only extract factual/legal claims (skip greetings, hedging language, meta-commentary)
- A claim is "verified" if a source directly supports it
- A claim is "contradicted" if a source explicitly says the opposite
- A claim is "unverified" if no source addresses it (this doesn't mean it's wrong)
- Confidence: 0.0 (no confidence) to 1.0 (absolute certainty)

Respond in JSON:
{
  "claims": [
    {
      "claim": "the factual statement",
      "status": "verified|unverified|contradicted",
      "confidence": 0.0-1.0,
      "source_index": 1,
      "reasoning": "brief explanation"
    }
  ]
}`,
            userOverride: `AI RESPONSE TO VERIFY:\n${responseText}\n\nSOURCE DOCUMENTS:\n${sourcesText}`,
        })

        const parsed = parseAIJSON(result, undefined)
        if (!parsed?.claims || !Array.isArray(parsed.claims)) {
            return emptyResult
        }

        // Process claims and apply confidence adjustments (H30)
        const verifiedClaims: VerifiedClaim[] = parsed.claims.map((claim: Record<string, unknown>) => {
            let baseConfidence = Number(claim.confidence) || 0.5
            const status = (['verified', 'unverified', 'contradicted'].includes(claim.status as string)
                ? claim.status
                : 'unverified') as ClaimVerificationStatus

            // H30: Confidence adjustments
            baseConfidence = adjustConfidence(
                baseConfidence,
                status,
                String(claim.claim || ''),
                ragChunks.length,
                claim.source_index as number | undefined
            )

            return {
                claim: String(claim.claim || ''),
                status,
                confidence: Math.round(baseConfidence * 100) / 100,
                sourceChunkIndex: claim.source_index as number | undefined,
                reasoning: claim.reasoning ? String(claim.reasoning) : undefined,
            }
        })

        const verifiedCount = verifiedClaims.filter(c => c.status === 'verified').length
        const unverifiedCount = verifiedClaims.filter(c => c.status === 'unverified').length
        const contradictedCount = verifiedClaims.filter(c => c.status === 'contradicted').length

        return {
            claims: verifiedClaims,
            overallConfidence: calculateOverallConfidence(verifiedClaims),
            verifiedCount,
            unverifiedCount,
            contradictedCount,
        }
    } catch (err) {
        logger.error("trust/claim-verifier", '[Trust H29] Claim verification failed', err)
        return emptyResult
    }
}

/**
 * H30: Adjust confidence based on multiple signals.
 * 
 * Scoring factors:
 * - Source count: more sources = higher baseline confidence for verified claims
 * - Citation markers: [N] citation markers boost confidence
 * - Specificity: claims with dates, numbers, names get boosted
 * - Status alignment: contradicted claims get confidence inverted
 */
function adjustConfidence(
    baseConfidence: number,
    status: ClaimVerificationStatus,
    claimText: string,
    sourceCount: number,
    sourceIndex?: number
): number {
    let adjusted = baseConfidence

    // 1. Source coverage bonus: more sources = higher confidence for verified claims
    if (status === 'verified' && sourceCount >= 3) {
        adjusted = Math.min(adjusted + 0.05, 1.0)
    }

    // 2. Citation marker bonus: if claim has [1], [2] etc., it's explicitly cited
    const hasCitation = /\[\d+\]/.test(claimText)
    if (hasCitation && status === 'verified') {
        adjusted = Math.min(adjusted + 0.1, 1.0)
    }

    // 3. Specificity bonus: claims with specific details are more precise
    const hasSpecifics = /\d{4}|\$[\d,]+|§\s*\d+|\d+%|[A-Z][a-z]+ v\. [A-Z]/.test(claimText)
    if (hasSpecifics && status === 'verified') {
        adjusted = Math.min(adjusted + 0.05, 1.0)
    }

    // 4. Contradicted claims: confidence represents how sure we are it's WRONG
    if (status === 'contradicted') {
        adjusted = Math.min(adjusted + 0.1, 1.0) // Boost confidence in the contradiction
    }

    // 5. Unverified claims: cap confidence lower since we can't confirm
    if (status === 'unverified') {
        adjusted = Math.min(adjusted, 0.5)
    }

    // 6. Direct source reference bonus
    if (sourceIndex && sourceIndex > 0 && status === 'verified') {
        adjusted = Math.min(adjusted + 0.05, 1.0)
    }

    return Math.max(0, Math.min(1, adjusted))
}

/**
 * Calculate overall confidence as a weighted average.
 * Verified claims weighted 1.0, unverified 0.5, contradicted 0.0.
 */
export function calculateOverallConfidence(claims: VerifiedClaim[]): number {
    if (claims.length === 0) return 0

    const weights: Record<ClaimVerificationStatus, number> = {
        verified: 1.0,
        unverified: 0.5,
        contradicted: 0.0,
    }

    let totalWeight = 0
    let weightedSum = 0

    for (const claim of claims) {
        const statusWeight = weights[claim.status]
        weightedSum += claim.confidence * statusWeight
        totalWeight += 1
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0
}
