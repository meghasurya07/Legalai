import { requireAuth } from '@/lib/auth/require-auth'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { resolveOpenAIClient } from '@/lib/byok'
import { supabase } from '@/lib/supabase/server'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'

/**
 * POST /api/ai/copilot — Ghost text completion for the editor
 * Streams AI completions as the user types
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth

    try {
        const body = await request.json()
        const { prompt, context, documentType } = body

        if (!prompt) return apiError('prompt is required', 400)

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

        const systemPrompt = `You are a legal document drafting assistant. You provide intelligent auto-completions for legal documents.

Document type: ${documentType || 'general'}

Rules:
- Complete the current sentence or thought naturally
- Use formal legal language appropriate for the document type
- Keep completions concise (1-2 sentences max)
- Do not repeat what was already written
- Do not add explanations or commentary
- Just provide the continuation text directly`

        const stream = await client.chat.completions.create({
            model: AI_MODELS.copilot,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Context:\n${context || ''}\n\nContinue writing after: "${prompt}"` },
            ],
            max_tokens: AI_TOKENS.copilot,
            temperature: AI_TEMPERATURES.creative,
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
        return apiError('Copilot completion failed', 500, err)
    }
}
