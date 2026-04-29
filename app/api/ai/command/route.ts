import { requireAuth } from '@/lib/auth/require-auth'
import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { resolveOpenAIClient } from '@/lib/byok'
import { supabase } from '@/lib/supabase/server'
import { AI_MODELS } from '@/lib/ai/config'

const COMMAND_PROMPTS: Record<string, string> = {
    draft: `Generate a well-structured legal document section based on the user's prompt. Use formal legal language with proper headings and numbered paragraphs where appropriate.`,
    rewrite: `Rewrite the selected text to improve clarity, precision, and legal accuracy. Maintain the same meaning but enhance the quality of the writing. Return only the rewritten text.`,
    tone: `Adjust the tone of the selected text. The user will specify the desired tone (formal, persuasive, neutral, concise). Return only the adjusted text.`,
    summarize: `Summarize the selected text concisely while preserving all key legal points and obligations. Return only the summary.`,
    expand: `Expand the selected text into a more detailed, comprehensive version with additional legal reasoning, examples, or provisions. Return only the expanded text.`,
    simplify: `Simplify the selected legal language into plain, easy-to-understand English while preserving the legal meaning and accuracy. Return only the simplified text.`,
    clause: `Generate a standard legal clause of the specified type. Use industry-standard language and best practices. Return only the clause text.`,
    citations: `Add relevant legal citations, case law references, or statutory references to support the selected text. Integrate them naturally into the text. Return the text with citations added.`,
}

/**
 * POST /api/ai/command — AI slash commands for the editor
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth

    try {
        const body = await request.json()
        const { command, selection, prompt, documentType, context } = body

        if (!command) return apiError('command is required', 400)

        const commandPrompt = COMMAND_PROMPTS[command]
        if (!commandPrompt) return apiError(`Unknown command: ${command}`, 400)

        // Resolve org for BYOK
        let orgId: string | undefined
        try {
            const { data: userSettings } = await supabase
                .from('user_settings')
                .select('default_org_id')
                .eq('user_id', userId)
                .single()
            if (userSettings?.default_org_id) orgId = userSettings.default_org_id
        } catch { /* no org context */ }

        const client = await resolveOpenAIClient(orgId)

        const systemPrompt = `You are an expert legal document drafting assistant.
Document type: ${documentType || 'general'}

Task: ${commandPrompt}

Rules:
- Return ONLY the requested text, no explanations or commentary
- Use professional legal language
- Maintain consistency with the document context
- Format with proper paragraphs and structure`

        let userPrompt = ''
        if (selection) userPrompt = `Selected text:\n"""${selection}"""\n\n`
        if (prompt) userPrompt += `User instruction: ${prompt}\n\n`
        if (context) userPrompt += `Document context:\n"""${context}"""\n`

        const stream = await client.chat.completions.create({
            model: AI_MODELS.chat,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt || 'Generate the requested content.' },
            ],
            max_tokens: 2000,
            temperature: 0.5,
            stream: true,
        })

        const encoder = new TextEncoder()
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const text = chunk.choices?.[0]?.delta?.content
                        if (text) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                        }
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                } catch {
                    controller.close()
                }
            }
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    } catch (err) {
        return apiError('AI command failed', 500, err)
    }
}
