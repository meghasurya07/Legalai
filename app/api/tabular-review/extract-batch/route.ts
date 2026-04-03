import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'
import { getUserId } from '@/lib/get-user-id'
import { checkRateLimit, RATE_LIMIT_HEAVY } from '@/lib/rate-limit'
import { resolveOpenAIClient } from '@/lib/byok'
import { logger } from '@/lib/logger'

/**
 * Batch extraction: extracts ALL columns for a single document in ONE API call.
 * This reduces API calls from (docs × columns) to just (docs).
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { allowed } = checkRateLimit(userId, RATE_LIMIT_HEAVY)
        if (!allowed) return apiError('Too many requests', 429)

        const { projectId, documentId, documentText, columns } = await request.json()

        if (!projectId || !documentId || !documentText || !columns || !Array.isArray(columns) || columns.length === 0) {
            return apiError('Missing required fields', 400)
        }

        // Resolve org context for BYOK
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch (err) { logger.error("extract-batch/route", "Operation failed", err) }

        const client = await resolveOpenAIClient(orgId)

        // Build column extraction instructions
        const columnInstructions = columns
            .map((col: { id: string; name: string; prompt: string }, i: number) =>
                `${i + 1}. "${col.name}" (id: "${col.id}"): ${col.prompt}`
            )
            .join('\n')

        const response = await client.chat.completions.create({
            model: AI_MODELS.tabularReview,
            messages: [
                {
                    role: 'system',
                    content: `You are a legal document extraction assistant. Extract multiple pieces of information from a document in one pass.

Rules:
- Be concise and factual
- If information is not found, use "—" as the value
- Do not make up information
- Keep each value under 200 words
- Use plain text, no markdown formatting
- If listing items, use semicolons to separate them

Respond in this exact JSON format:
{
  "results": {
    "<column_id>": "extracted value",
    ...
  }
}`
                },
                {
                    role: 'user',
                    content: `Extract the following fields from this document:

${columnInstructions}

DOCUMENT TEXT:
${documentText.slice(0, 15000)}

Respond with JSON containing results for each column ID.`
                }
            ],
            max_tokens: AI_TOKENS.tabularReview.extractBatch,
            temperature: AI_TEMPERATURES.precise,
            response_format: { type: "json_object" }
        })

        const content = response.choices[0]?.message?.content?.trim()
        if (!content) {
            return apiError('No response from AI', 500)
        }

        const parsed = JSON.parse(content)
        const results: Record<string, string> = {}

        // Normalize results
        for (const col of columns) {
            const value = parsed.results?.[col.id] || parsed[col.id] || '—'
            results[col.id] = typeof value === 'string' ? value.trim() : String(value)
        }

        return NextResponse.json({ results })
    } catch (error) {
        console.error('[Tabular Review Batch Extract] Error:', error)
        return apiError('Batch extraction failed', 500, error)
    }
}
