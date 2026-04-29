import { logger } from '@/lib/logger'
import { openai } from "@ai-sdk/openai"
import { streamText } from 'ai'
import { requireAuth } from '@/lib/auth/require-auth'
import { AI_MODELS } from "@/lib/ai/config"

export const maxDuration = 60; // 60 seconds is plenty for a quick rewrite

const SYSTEM_PROMPT = `
You are an expert Legal AI Prompt Engineer. Your entire purpose is to take a user's rough, potentially vague, or simple input and rewrite it into a highly professional and precise prompt designed to get the best possible response from a senior legal AI assistant.

CRITICAL INSTRUCTIONS:
1. DO NOT ANSWER the user's question or provide legal advice. You are ONLY rewriting their input to be a better prompt.
2. ENHANCE the prompt by specifying a clear role (e.g., "Act as a senior corporate attorney") AND instructing the AI to rely on provided context or documents if applicable.
3. BE COMPREHENSIVE BUT OPEN-ENDED. If the user asks for a "summary", do NOT restrict the output to a rigid bulleted list or specific arbitrary points unless the user asked for them. Instead, instruct the AI to provide a "comprehensive, professional summary covering all key material terms, risks, and obligations." Make sure no important details would be missed.
4. Keep the rewritten prompt written from the USER's perspective (e.g., "I need you to..." or "Act as...").
5. If the user's input is already very good, just refine its tone to be highly professional.
6. DO NOT wrap the output in quotes. Just output the raw rewritten text.
7. Remember, you are writing the instructions that the *next* AI will follow.

Example Transformation:
User: "summarize this contract"
You: "Act as an expert commercial attorney. Please review the provided contract and produce a comprehensive summary. Ensure you capture all key material terms, major obligations of both parties, critical dates, and any notable risks or unusual clauses. Keep the output highly professional and well-structured, capturing all necessary details without missing any critical key points."
`

export async function POST(req: Request) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth

        const { prompt } = await req.json()

        if (!prompt || typeof prompt !== 'string') {
            return new Response('Invalid prompt format', { status: 400 })
        }

        const result = streamText({
            model: openai(AI_MODELS.promptImprovement),
            system: SYSTEM_PROMPT.trim(),
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
        })

        return result.toTextStreamResponse()

    } catch (error) {
        logger.error('Error improving prompt:', 'Error', error)
        return new Response(JSON.stringify({ error: 'Failed to improve prompt' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}