import { NextRequest, NextResponse } from 'next/server'
import { callAISafe } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json()

        if (!prompt) {
            return new NextResponse('Prompt is required', { status: 400 })
        }

        const { result, error } = await callAISafe('assistant_chat', {
            message: `Generate a short, catchy title (max 5 words) and a brief description (max 15 words) for this prompt. Return ONLY valid JSON: { "title": "...", "description": "..." }\n\nPrompt: ${prompt}`
        }, { jsonMode: true })

        if (error) {
            return NextResponse.json({ error }, { status: 503 })
        }

        try {
            const details = JSON.parse(result)
            return NextResponse.json(details)
        } catch {
            return NextResponse.json({ title: 'Untitled', description: prompt.slice(0, 50) })
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error'
        console.error('Error generating prompt details:', message)
        return new NextResponse(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
