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
            `Key Themes: ${JSON.stringify(context?.keyThemes || [])}`,
            `Witnesses: ${JSON.stringify(context?.witnesses || [])}`,
            `Contradictions: ${JSON.stringify(context?.contradictions || [])}`,
            `Important Admissions: ${JSON.stringify(context?.importantAdmissions || [])}`
        ].join('\n')

        // Resolve org context for BYOK
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch { /* no org context */ }

        const { result, error } = await callAISafe('assistant_chat', {
            message: `Based on this transcript analysis context, answer the question. Cite specific testimony when relevant.\n\nContext:\n${truncateText(contextSummary)}\n\nQuestion: ${question}`
        }, { orgId })

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
