import { logger } from '@/lib/logger'
import { openai } from "@ai-sdk/openai"
import { streamText } from 'ai'
import { requireAuth } from '@/lib/auth/require-auth'
import { AI_MODELS } from "@/lib/ai/config"

export const maxDuration = 60; // 60 seconds is plenty for a quick rewrite

const SYSTEM_PROMPT = `
You are an expert Legal AI Prompt Engineer. Your entire purpose is to take a user's rough, potentially vague, or simple input and rewrite it into a highly professional and precise prompt designed to get the best possible response from a senior legal AI assistant.

CRITICAL INSTRUCTIONS:
1. FIRST: Evaluate whether the user's input is a genuine, meaningful request. If the input is random characters, keyboard spam, gibberish, nonsensical text, or has no discernible intent, respond with EXACTLY: "[INVALID]" and nothing else. Examples of invalid input: "asdfsadsad", "hjkl;;", "aaaa", "test123test", "xyzxyz", random letter sequences.
2. DO NOT ANSWER the user's question or provide legal advice. You are ONLY rewriting their input to be a better prompt.
3. ENHANCE the prompt by specifying a clear role (e.g., "Act as a senior corporate attorney") AND instructing the AI to rely on provided context or documents if applicable.
4. KEEP IT CONCISE. The improved prompt MUST be 2-3 sentences maximum. Do NOT write paragraphs. Be precise and direct.
5. Keep the rewritten prompt written from the USER's perspective (e.g., "I need you to..." or "Act as...").
6. If the user's input is already very good, just refine its tone to be highly professional.
7. DO NOT wrap the output in quotes. Just output the raw rewritten text.

Example Transformation:
User: "summarize this contract"
You: "Act as an expert commercial attorney. Review the provided contract and produce a comprehensive summary covering all key material terms, obligations, critical dates, and notable risks or unusual clauses."
`

export async function POST(req: Request) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        // Rate limit prompt improvement requests (max 30/min per user)
        const { checkRateLimit, RATE_LIMIT_AI } = await import('@/lib/rate-limit')
        const { allowed } = checkRateLimit(`improve-prompt:${userId}`, RATE_LIMIT_AI)
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const { prompt } = await req.json()

        if (!prompt || typeof prompt !== 'string') {
            return new Response('Invalid prompt format', { status: 400 })
        }

        const trimmed = prompt.trim()

        // Reject too-short inputs (less than 3 real characters)
        if (trimmed.length < 3) {
            return new Response(JSON.stringify({ error: 'Please enter a longer prompt to improve.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Basic gibberish detection: reject if no vowels or real words
        const hasVowels = /[aeiouAEIOU]/.test(trimmed)
        const hasSpaces = /\s/.test(trimmed)
        const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, '')).size
        if ((!hasVowels || uniqueChars < 3) && !hasSpaces) {
            return new Response(JSON.stringify({ error: 'Your input doesn\'t appear to be a valid prompt. Please enter a meaningful question or instruction.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const result = streamText({
            model: openai(AI_MODELS.promptImprovement),
            system: SYSTEM_PROMPT.trim(),
            messages: [{ role: 'user', content: trimmed }],
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