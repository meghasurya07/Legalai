import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { apiError } from '@/lib/api-utils'
import mammoth from 'mammoth'

/**
 * POST /api/drafts/import — Import a DOCX file into a new draft
 * Accepts multipart form data with a .docx file
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth

    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) return apiError('No file provided', 400)

        const fileName = file.name.toLowerCase()
        if (!fileName.endsWith('.docx')) {
            return apiError('Only .docx files are supported', 400)
        }

        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ buffer })
        const html = result.value
        const warnings = result.messages.filter(m => m.type === 'warning').map(m => m.message)

        // Convert HTML to Plate.js nodes
        const plateContent = htmlToPlateNodes(html)
        const plainText = extractPlainText(plateContent)
        const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length
        const title = file.name.replace(/\.docx$/i, '')

        return NextResponse.json({
            content: plateContent,
            plainText,
            wordCount,
            title,
            warnings,
        })
    } catch (err) {
        logger.error('drafts', 'Import DOCX error', err)
        return apiError('Failed to import document', 500)
    }
}

/**
 * Converts HTML string to Plate.js editor JSON nodes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function htmlToPlateNodes(html: string): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes: any[] = []




    // Simple approach: split by paragraphs and headings
    const cleanHtml = html
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')

    // Process block-level elements
    const lines = cleanHtml.split(/<\/(?:p|h[1-6]|blockquote|li)>/gi)

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        // Detect heading level
        const headingMatch = line.match(/<h([1-6])[^>]*>/i)
        if (headingMatch) {
            const level = parseInt(headingMatch[1])
            const text = stripHtmlTags(line.replace(/<h[1-6][^>]*>/gi, ''))
            if (text.trim()) {
                nodes.push({
                    type: level <= 3 ? `h${level}` : 'p',
                    children: parseInlineHtml(text),
                })
            }
            continue
        }

        // Detect blockquote
        if (line.includes('<blockquote')) {
            const text = stripHtmlTags(line.replace(/<blockquote[^>]*>/gi, ''))
            if (text.trim()) {
                nodes.push({ type: 'blockquote', children: parseInlineHtml(text) })
            }
            continue
        }

        // Detect list items
        if (line.includes('<li')) {
            const text = stripHtmlTags(line.replace(/<li[^>]*>/gi, ''))
            if (text.trim()) {
                nodes.push({ type: 'p', children: [{ text: `• ${text.trim()}` }] })
            }
            continue
        }

        // Detect HR
        if (line.includes('<hr')) {
            nodes.push({ type: 'hr', children: [{ text: '' }] })
            continue
        }

        // Regular paragraph
        const text = stripHtmlTags(line.replace(/<p[^>]*>/gi, ''))
        if (text.trim()) {
            nodes.push({ type: 'p', children: parseInlineHtml(text) })
        }
    }

    // Ensure at least one node
    if (nodes.length === 0) {
        // Fallback: just extract all text
        const allText = stripHtmlTags(html)
        if (allText.trim()) {
            for (const para of allText.split('\n\n')) {
                if (para.trim()) {
                    nodes.push({ type: 'p', children: [{ text: para.trim() }] })
                }
            }
        }
    }

    return nodes.length > 0 ? nodes : [{ type: 'p', children: [{ text: '' }] }]
}

/**
 * Parse inline HTML formatting (bold, italic, underline)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInlineHtml(text: string): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = []
    // Simple regex-based inline parser
    const inlineRegex = /<(strong|b|em|i|u|s|mark)>([\s\S]*?)<\/\1>/gi
    let lastIdx = 0
    let m

    const cleanText = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')

    while ((m = inlineRegex.exec(cleanText)) !== null) {
        if (m.index > lastIdx) {
            const before = stripHtmlTags(cleanText.slice(lastIdx, m.index))
            if (before) children.push({ text: before })
        }

        const tag = m[1].toLowerCase()
        const innerText = stripHtmlTags(m[2])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const child: any = { text: innerText }
        if (tag === 'strong' || tag === 'b') child.bold = true
        if (tag === 'em' || tag === 'i') child.italic = true
        if (tag === 'u') child.underline = true
        if (tag === 's') child.strikethrough = true
        if (tag === 'mark') child.highlight = true

        children.push(child)
        lastIdx = m.index + m[0].length
    }

    if (lastIdx < cleanText.length) {
        const remaining = stripHtmlTags(cleanText.slice(lastIdx))
        if (remaining) children.push({ text: remaining })
    }

    return children.length > 0 ? children : [{ text: stripHtmlTags(cleanText) || '' }]
}

function stripHtmlTags(html: string): string {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlainText(nodes: any[]): string {
    let text = ''
    for (const node of nodes) {
        if (node.children) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const child of node.children as any[]) {
                if (typeof child.text === 'string') text += child.text
            }
            text += '\n'
        }
    }
    return text.trim()
}
