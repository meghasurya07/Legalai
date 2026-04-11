import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'
import { getUserId } from '@/lib/auth/get-user-id'
import { checkRateLimit, RATE_LIMIT_HEAVY } from '@/lib/rate-limit'
import { resolveOpenAIClient } from '@/lib/byok'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { allowed } = checkRateLimit(userId, RATE_LIMIT_HEAVY)
        if (!allowed) return apiError('Too many requests', 429)

        const { projectId, documentId, columnPrompt, columnName, documentText } = await request.json()

        if (!projectId || !documentId || !columnPrompt || !documentText) {
            return apiError('Missing required fields', 400)
        }

        // Resolve org context for BYOK
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch (err) { logger.error("extract/route", "Operation failed", err) }

        const client = await resolveOpenAIClient(orgId)

        const response = await client.chat.completions.create({
            model: AI_MODELS.tabularReview,
            messages: [
                {
                    role: 'system',
                    content: `You are a legal document extraction assistant. Your job is to extract specific information from legal documents for a tabular review. 
                    
Rules:
- Be concise and factual
- If the information is not found, respond with only "—"
- Do not make up information
- Keep responses under 200 words
- Use plain text, no markdown formatting
- If listing items, use semicolons to separate them`
                },
                {
                    role: 'user',
                    content: `Extract the following from this document:

COLUMN: ${columnName}
EXTRACTION PROMPT: ${columnPrompt}

DOCUMENT TEXT:
${documentText}

Provide ONLY the extracted information, nothing else.`
                }
            ],
            max_tokens: AI_TOKENS.tabularReview.extract,
            temperature: AI_TEMPERATURES.precise,
        })

        const content = response.choices[0]?.message?.content?.trim() || 'No content extracted'

        return NextResponse.json({ content })
    } catch (error) {
        console.error('[Tabular Review Extract] Error:', error)
        return apiError('Extraction failed', 500, error)
    }
}
