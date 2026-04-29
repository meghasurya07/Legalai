"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FileEdit, Loader2, ExternalLink, Check } from 'lucide-react'
import { toast } from 'sonner'

interface DraftActionCardProps {
    content: string
    title?: string
    documentType?: string
    messageId?: string
    conversationId?: string
}

/**
 * Parses a chat message for draft content blocks.
 * Format: <!--DRAFT_CONTENT:{"title":"...","documentType":"..."}-->
 * Also detects when the AI was asked to draft/write something by analyzing the response.
 */
export function parseDraftAction(content: string): {
    cleanMessage: string
    hasDraftContent: boolean
    draftTitle?: string
    draftType?: string
    alreadyOpened: boolean
} {
    // Check for explicit draft markers
    const draftRegex = /<!--DRAFT_CONTENT:([\s\S]*?)-->/
    const match = content.match(draftRegex)

    // Check for "already opened" marker
    const alreadyOpened = content.includes('<!--DRAFT_OPENED-->')

    if (match) {
        try {
            const meta = JSON.parse(match[1])
            const cleanMessage = content.replace(draftRegex, '').replace('<!--DRAFT_OPENED-->', '').trim()
            return {
                cleanMessage,
                hasDraftContent: true,
                draftTitle: meta.title,
                draftType: meta.documentType || 'general',
                alreadyOpened,
            }
        } catch {
            // Invalid JSON in marker
        }
    }

    // Auto-detect drafting intent from content length and structure
    // If the AI generated a long, structured response with headings, it's likely a draft
    const isLongStructured = content.length > 500 &&
        (content.includes('##') || content.includes('**Section')) &&
        !content.includes('<!--DRAFT_OPENED-->')

    return {
        cleanMessage: content.replace('<!--DRAFT_OPENED-->', '').trim(),
        hasDraftContent: isLongStructured,
        draftTitle: undefined,
        draftType: 'general',
        alreadyOpened,
    }
}

/**
 * Converts markdown content to Plate.js editor JSON nodes
 */
function markdownToPlateNodes(markdown: string): unknown[] {
    const lines = markdown.split('\n')
    const nodes: unknown[] = []

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
            nodes.push({ type: 'p', children: [{ text: '' }] })
            continue
        }

        // Headings
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
            // Process inline formatting (bold, italic)
            const children = parseInlineFormatting(trimmed)
            nodes.push({ type: 'p', children })
        }
    }

    return nodes.length > 0 ? nodes : [{ type: 'p', children: [{ text: '' }] }]
}

function parseInlineFormatting(text: string): unknown[] {
    const children: unknown[] = []
    // Simple bold/italic parser
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

export function DraftActionCard({ content, title, documentType, messageId, conversationId }: DraftActionCardProps) {
    const router = useRouter()
    const [isCreating, setIsCreating] = useState(false)
    const [created, setCreated] = useState(false)

    const handleOpenInEditor = async () => {
        setIsCreating(true)
        try {
            // Convert the markdown content to Plate.js JSON
            const plateContent = markdownToPlateNodes(content)
            const plainText = content.replace(/[#*_>`-]/g, '').trim()
            const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length

            // Create the draft
            const res = await fetch('/api/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title || 'AI-Generated Draft',
                    content: plateContent,
                    contentText: plainText,
                    documentType: documentType || 'general',
                    wordCount,
                }),
            })

            if (!res.ok) throw new Error('Failed to create draft')
            const data = await res.json()

            // Mark as opened in the message
            if (messageId && conversationId) {
                const updatedContent = content + '\n<!--DRAFT_OPENED-->'
                fetch(`/api/chat/conversations/${conversationId}/messages`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId, content: updatedContent }),
                }).catch(() => { /* silent */ })
            }

            setCreated(true)
            toast.success('Draft created — opening editor')

            // Navigate to the editor
            router.push(`/drafts/${data.draft.id}`)
        } catch {
            toast.error('Failed to create draft')
        } finally {
            setIsCreating(false)
        }
    }

    if (created) {
        return (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 rounded-lg px-3 py-2 mt-3">
                <Check className="h-3.5 w-3.5" />
                <span>Opened in editor</span>
            </div>
        )
    }

    return (
        <div className="mt-3 border border-violet-200 dark:border-violet-800/40 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0">
                    <FileEdit className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Draft Ready</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        This content can be opened in the document editor for further editing, formatting, and export.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <Button
                            size="sm"
                            className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm text-xs h-8"
                            onClick={handleOpenInEditor}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <ExternalLink className="h-3.5 w-3.5" />
                            )}
                            Open in Editor
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
