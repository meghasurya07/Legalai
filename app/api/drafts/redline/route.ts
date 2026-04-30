import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { apiError } from '@/lib/api-utils'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'

interface RedlineChange {
    type: 'insertion' | 'deletion' | 'modification'
    original: string
    revised: string
    section: string
    severity: 'high' | 'medium' | 'low'
    explanation: string
}

/**
 * POST /api/drafts/redline — AI-powered smart redlining
 * Compares your draft against a counterparty document and generates tracked changes
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth

    try {
        const body = await request.json()
        const { draftText, counterpartyText, focus } = body

        if (!draftText) return apiError('draftText is required', 400)
        if (!counterpartyText) return apiError('counterpartyText is required', 400)

        // Resolve OpenAI client
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const orgCtx = await getOrgContext()
            orgId = orgCtx?.orgId
        } catch { /* no org context */ }

        const { resolveOpenAIClient } = await import('@/lib/byok')
        const client = await resolveOpenAIClient(orgId)

        const systemPrompt = `You are an expert legal document redlining specialist. Compare two versions of a legal document and identify all changes.

Return a JSON object with the following structure:
{
  "summary": "Brief overview of the key changes",
  "totalChanges": number,
  "riskLevel": "high" | "medium" | "low",
  "changes": [
    {
      "type": "insertion" | "deletion" | "modification",
      "original": "Original text (empty for insertions)",
      "revised": "New text (empty for deletions)",
      "section": "Section name or number where the change occurs",
      "severity": "high" | "medium" | "low",
      "explanation": "Legal significance of this change"
    }
  ],
  "recommendations": ["Actionable recommendations for the reviewing attorney"]
}

Rules:
- Focus on legally significant changes, not formatting
- Flag any changes that increase liability, shift risk, or modify key terms
- High severity: changes to indemnification, liability caps, termination rights, governing law
- Medium severity: changes to notice periods, representations, warranties
- Low severity: minor wording changes, clarifications
${focus ? `\nSpecial focus area: ${focus}` : ''}`

        const response = await client.chat.completions.create({
            model: AI_MODELS.redline,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Compare these two documents and identify all changes:\n\nYOUR DRAFT:\n${draftText.substring(0, 15000)}\n\n---\n\nCOUNTERPARTY VERSION:\n${counterpartyText.substring(0, 15000)}`
                },
            ],
            max_tokens: AI_TOKENS.redline,
            temperature: AI_TEMPERATURES.precise,
            response_format: { type: 'json_object' },
        })

        const result = response.choices[0]?.message?.content || '{}'
        let parsed

        try {
            parsed = JSON.parse(result)
        } catch {
            parsed = {
                summary: 'Unable to parse redline comparison',
                changes: [],
                totalChanges: 0,
                riskLevel: 'low',
                recommendations: [],
            }
        }

        return NextResponse.json(parsed)
    } catch (err) {
        logger.error('drafts', 'Redline error', err)
        return apiError('Failed to generate redline comparison', 500)
    }
}
