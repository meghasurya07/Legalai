import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from '@/lib/ai/config'

/**
 * POST /api/drafts/from-project — Generate a draft from project files
 * Uses extracted text from project files + AI to generate initial draft
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth

    try {
        const body = await request.json()
        const { projectId, prompt, documentType } = body

        if (!projectId) return apiError('projectId is required', 400)

        // Fetch project files with extracted text
        const { data: files, error: filesError } = await supabase
            .from('files')
            .select('id, name, extracted_text')
            .eq('project_id', projectId)
            .not('extracted_text', 'is', null)

        if (filesError) return apiError('Failed to fetch project files', 500)

        if (!files || files.length === 0) {
            return apiError('No files with extracted text found in this project', 400)
        }

        // Build context from file contents
        const fileContext = files.map((f, i) =>
            `--- FILE ${i + 1}: ${f.name} ---\n${(f.extracted_text as string).substring(0, 8000)}`
        ).join('\n\n')

        // Resolve OpenAI client
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const orgCtx = await getOrgContext()
            orgId = orgCtx?.orgId
        } catch { /* no org context */ }

        const { resolveOpenAIClient } = await import('@/lib/byok')
        const client = await resolveOpenAIClient(orgId)

        const systemPrompt = `You are an expert legal document drafter. Based on the provided source documents, generate a new ${documentType || 'legal'} document.

Rules:
- Draft in professional legal language
- Use proper document structure with headings and numbered sections
- Reference specific terms, dates, parties from the source documents
- Use markdown formatting (## for headings, **bold** for key terms, numbered lists for clauses)
- Generate a complete, ready-to-edit document`

        const userPrompt = prompt
            ? `Based on the following source documents, ${prompt}\n\n${fileContext}`
            : `Based on the following source documents, draft a comprehensive ${documentType || 'legal'} document that captures the key terms, obligations, and provisions:\n\n${fileContext}`

        const response = await client.chat.completions.create({
            model: AI_MODELS.drafting,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: AI_TOKENS.drafting,
            temperature: AI_TEMPERATURES.balanced,
        })

        const draftContent = response.choices[0]?.message?.content || ''

        // Convert markdown to Plate.js nodes
        const plateContent = markdownToPlateNodes(draftContent)
        const wordCount = draftContent.split(/\s+/).filter(w => w.length > 0).length

        // Create the draft
        let draftOrgId = '00000000-0000-0000-0000-000000000001'
        try {
            const { data: userSettings } = await supabase
                .from('user_settings')
                .select('default_org_id')
                .eq('user_id', userId)
                .single()
            if (userSettings?.default_org_id) draftOrgId = userSettings.default_org_id
        } catch { /* fallback org */ }

        const { data: draft, error: draftError } = await supabase
            .from('drafts')
            .insert({
                user_id: userId,
                org_id: draftOrgId,
                project_id: projectId,
                title: prompt ? prompt.substring(0, 100) : `Draft from Project Files`,
                content: plateContent,
                content_text: draftContent,
                document_type: documentType || 'general',
                word_count: wordCount,
                status: 'draft',
            })
            .select()
            .single()

        if (draftError) return apiError('Failed to create draft', 500)

        return NextResponse.json({ draft })
    } catch (err) {
        logger.error('drafts', 'from-project error', err)
        return apiError('Failed to generate draft from project files', 500)
    }
}

/**
 * Convert markdown to Plate.js nodes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function markdownToPlateNodes(markdown: string): any[] {
    const lines = markdown.split('\n')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes: any[] = []

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
            nodes.push({ type: 'p', children: [{ text: '' }] })
            continue
        }

        if (trimmed.startsWith('### ')) {
            nodes.push({ type: 'h3', children: [{ text: trimmed.slice(4) }] })
        } else if (trimmed.startsWith('## ')) {
            nodes.push({ type: 'h2', children: [{ text: trimmed.slice(3) }] })
        } else if (trimmed.startsWith('# ')) {
            nodes.push({ type: 'h1', children: [{ text: trimmed.slice(2) }] })
        } else if (trimmed.startsWith('> ')) {
            nodes.push({ type: 'blockquote', children: [{ text: trimmed.slice(2) }] })
        } else if (trimmed.startsWith('---')) {
            nodes.push({ type: 'hr', children: [{ text: '' }] })
        } else {
            nodes.push({ type: 'p', children: parseInline(trimmed) })
        }
    }

    return nodes.length > 0 ? nodes : [{ type: 'p', children: [{ text: '' }] }]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInline(text: string): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = []
    const regex = /\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            children.push({ text: text.slice(lastIndex, match.index) })
        }
        if (match[1] || match[2]) {
            children.push({ text: match[1] || match[2], bold: true })
        } else if (match[3] || match[4]) {
            children.push({ text: match[3] || match[4], italic: true })
        }
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
        children.push({ text: text.slice(lastIndex) })
    }

    return children.length > 0 ? children : [{ text }]
}
