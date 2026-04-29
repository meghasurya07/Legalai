import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

interface RouteParams {
    params: Promise<{ id: string }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plateNodesToDocxParagraphs(nodes: any[]): Paragraph[] {
    const paragraphs: Paragraph[] = []

    for (const node of nodes) {
        if (!node) continue

        const type = node.type || 'p'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children = (node.children || []).map((child: any) => {
            return new TextRun({
                text: child.text || '',
                bold: child.bold || false,
                italics: child.italic || false,
                underline: child.underline ? {} : undefined,
                strike: child.strikethrough || false,
                font: 'Times New Roman',
                size: type.startsWith('h') ? (type === 'h1' ? 32 : type === 'h2' ? 28 : 24) : 24,
            })
        })

        let heading: typeof HeadingLevel[keyof typeof HeadingLevel] | undefined
        if (type === 'h1') heading = HeadingLevel.HEADING_1
        else if (type === 'h2') heading = HeadingLevel.HEADING_2
        else if (type === 'h3') heading = HeadingLevel.HEADING_3

        paragraphs.push(new Paragraph({
            children,
            heading,
            alignment: node.align === 'center' ? AlignmentType.CENTER :
                       node.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 200 },
        }))
    }

    return paragraphs
}

/**
 * POST /api/drafts/[id]/export — Export draft to DOCX
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id } = await params

    try {
        const { data: draft, error } = await supabase
            .from('drafts')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (error || !draft) return apiError('Draft not found', 404)

        const content = Array.isArray(draft.content) ? draft.content : []
        const paragraphs = plateNodesToDocxParagraphs(content)

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                children: paragraphs,
            }],
        })

        const buffer = await Packer.toBuffer(doc)
        const uint8 = new Uint8Array(buffer)

        const filename = `${draft.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'document'}.docx`

        return new NextResponse(uint8, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        logger.error('drafts', `Export [${id}] error`, err)
        return apiError('Failed to export draft', 500)
    }
}
