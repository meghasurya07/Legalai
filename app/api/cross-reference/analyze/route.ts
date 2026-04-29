import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { apiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit, RATE_LIMIT_HEAVY } from '@/lib/rate-limit'
import { AI_MODELS, AI_TEMPERATURES } from '@/lib/ai/config'
import { resolveOpenAIClient } from '@/lib/byok'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth
        if (!userId) return apiError('Unauthorized', 401)

        const { allowed } = checkRateLimit(userId, RATE_LIMIT_HEAVY)
        if (!allowed) return apiError('Too many requests', 429)

        const { projectId, prompt, anchorDocument, targetDocuments } = await request.json()

        if (!projectId || !prompt || !anchorDocument || !targetDocuments || !targetDocuments.length) {
            return apiError('Missing required fields', 400)
        }

        // Resolve org context for BYOK
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch (err) { logger.error("analyze/route", "Operation failed", err) }

        // Get the resolved client to extract its API key for Vercel AI SDK
        const resolvedClient = await resolveOpenAIClient(orgId)
        const resolvedApiKey = (resolvedClient as { apiKey?: string }).apiKey ?? process.env.OPENAI_API_KEY ?? ''
        const openai = createOpenAI({ apiKey: resolvedApiKey })

        const systemPrompt = `You are a sophisticated legal AI assistant tasked with cross-referencing and comparing clauses across multiple legal documents.
You will be provided with an Anchor Document and one or more Target Documents.
Your goal is to answer the user's prompt by extracting the relevant clause from the Anchor Document, summarizing it, and then comparing it to how each Target Document handles that same topic.
You must strictly declare if a contradiction or significant deviation exists and assign a risk level ("None", "Low", "Medium", "High").`

        const userPrompt = `USER PROMPT (what to compare): ${prompt}

=== ANCHOR DOCUMENT (ID: ${anchorDocument.id}): ${anchorDocument.name} ===
${anchorDocument.text}

=== TARGET DOCUMENTS ===
${targetDocuments.map((doc: { id: string, name: string, text: string }, index: number) => `
--- Target Document [${index + 1}] ---
ID: ${doc.id}
Name: ${doc.name}
Text:
${doc.text}
`).join('\n')}`

        const { object } = await generateObject({
            model: openai(AI_MODELS.docIntel),
            schema: z.object({
                results: z.array(z.object({
                    targetDocumentId: z.string().describe("The exact ID of the target document as provided in the prompt."),
                    clauseName: z.string().describe("Short name for the clause/topic being compared (e.g. 'Governing Law')."),
                    anchorSummary: z.string().describe("A concise summary of what the Anchor Document asserts about this clause."),
                    targetSummary: z.string().describe("A concise summary of what this Target Document asserts instead."),
                    isContradiction: z.boolean().describe("True if the target document contradicts, deviates significantly, or omits a crucial requirement from the anchor document."),
                    riskLevel: z.enum(["None", "Low", "Medium", "High"]).describe("Risk level of the contradiction or deviation."),
                    explanation: z.string().describe("Concise explanation of the difference and why it is categorized as such.")
                }))
            }),
            system: systemPrompt,
            prompt: userPrompt,
            temperature: AI_TEMPERATURES.precise,
        })

        return NextResponse.json(object)
    } catch (error) {
        logger.error('cross-reference/analyze', 'Cross reference analysis failed', error)
        return apiError('Cross reference analysis failed', 500, error)
    }
}
