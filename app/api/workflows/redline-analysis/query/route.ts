import { NextRequest, NextResponse } from 'next/server'
import { callAISafe } from '@/lib/ai/client'
import { truncateText } from '@/lib/ai/client'

export async function POST(request: NextRequest) {
    try {
        const { question, context } = await request.json()

        if (!question) {
            return NextResponse.json(
                { error: 'Question is required' },
                { status: 400 }
            )
        }

        const contextSummary = [
            `Summary: ${context?.summary || 'N/A'}`,
            `Total Changes: ${context?.statistics?.totalChanges || 0}`,
            `Additions: ${(context?.changes?.additions || []).join(', ')}`,
            `Deletions: ${(context?.changes?.deletions || []).join(', ')}`,
            `Modifications: ${(context?.changes?.modifications || []).join(', ')}`
        ].join('\n')

        const { result, error } = await callAISafe('assistant_chat', {
            message: `Based on this redline analysis context, answer the question.\n\nContext:\n${truncateText(contextSummary)}\n\nQuestion: ${question}`
        })

        if (error) {
            return NextResponse.json({ error }, { status: 503 })
        }

        return NextResponse.json({ answer: result })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to process question'
        console.error('Query error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
