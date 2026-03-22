import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/get-user-id'
import { checkRateLimit, RATE_LIMIT_HEAVY } from '@/lib/rate-limit'
import { AI_MODELS, AI_TEMPERATURES } from '@/lib/ai/config'

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { allowed } = checkRateLimit(userId, RATE_LIMIT_HEAVY)
        if (!allowed) return apiError('Too many requests', 429)

        const { projectId, prompt, anchorDocument, targetDocuments } = await request.json()

        if (!projectId || !prompt || !anchorDocument || !targetDocuments || !targetDocuments.length) {
            return apiError('Missing required fields', 400)
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return apiError('AI service is not configured', 503)
        }

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
        console.error('[Cross Reference Analyze] Error:', error)
        return apiError('Cross reference analysis failed', 500, error)
    }
}
