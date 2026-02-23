import { NextRequest, NextResponse } from 'next/server'
import { callAISafe } from '@/lib/ai/client'

export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json()

        if (!prompt?.trim()) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }

        const { result, error } = await callAISafe('prompt_improve', {
            prompt: prompt.trim()
        })

        if (error) {
            return NextResponse.json({ error }, { status: 503 })
        }

        return NextResponse.json({ improved: result.trim() })
    } catch (error) {
        console.error('Improve prompt API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
