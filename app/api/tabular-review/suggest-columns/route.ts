import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { apiError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
    try {
        const { projectId, documentSamples } = await request.json()

        if (!projectId || !documentSamples || !Array.isArray(documentSamples) || documentSamples.length === 0) {
            return apiError('Missing required fields', 400)
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return apiError('AI service is not configured', 503)
        }

        const client = new OpenAI({ apiKey })

        // Build a sample of documents for the AI to analyze
        const sampleText = documentSamples
            .slice(0, 5) // Max 5 documents to avoid token limits
            .map((doc: { name: string; text: string }, i: number) =>
                `Document ${i + 1}: "${doc.name}"\n${doc.text.slice(0, 2000)}`
            )
            .join('\n\n---\n\n')

        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a legal document analysis assistant. Given a set of legal documents, suggest the most relevant columns for a tabular review spreadsheet.

Rules:
- Suggest as many columns as are necessary to capture all meaningful extractable datapoints from these documents
- There is no limit to the number of columns you should return
- Each column should extract a specific, useful piece of information
- Column names should be short (1-3 words)
- Prompts should be clear extraction instructions
- Focus on what's actually IN these documents, not generic fields
- Always include "Parties" as the first column
- Pick columns that are MOST RELEVANT to the specific document type

Respond in this exact JSON format:
{
  "columns": [
    { "name": "Column Name", "prompt": "Extraction instruction for this column" }
  ]
}`
                },
                {
                    role: 'user',
                    content: `Analyze these ${documentSamples.length} documents and suggest the best columns for a tabular review:\n\n${sampleText}`
                }
            ],
            max_tokens: 800,
            temperature: 0.3,
            response_format: { type: "json_object" }
        })

        const content = response.choices[0]?.message?.content?.trim()

        if (!content) {
            return apiError('No response from AI', 500)
        }

        const parsed = JSON.parse(content)

        if (!parsed.columns || !Array.isArray(parsed.columns)) {
            return apiError('Invalid AI response format', 500)
        }

        // Validate and clean response
        const columns = parsed.columns
            .filter((col: { name?: string; prompt?: string }) => col.name && col.prompt)
            .map((col: { name: string; prompt: string }) => ({
                name: col.name,
                prompt: col.prompt
            }))

        console.log(`[Tabular Review] AI suggested ${columns.length} columns for project ${projectId}: ${columns.map((c: { name: string }) => c.name).join(', ')}`)

        return NextResponse.json({ columns })
    } catch (error) {
        console.error('[Tabular Review Suggest] Error:', error)
        return apiError('Column suggestion failed', 500, error)
    }
}
