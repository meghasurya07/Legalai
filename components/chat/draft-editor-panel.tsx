"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    X, Save, FileEdit, Loader2, Check, Maximize2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PlateEditor } from '@/components/editor/plate-editor'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DraftEditorPanelProps {
    isOpen: boolean
    title: string
    documentType: string
    content: string
    isStreaming: boolean
    onClose: () => void
}

/**
 * Converts streaming markdown content to Plate.js editor JSON nodes.
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

        if (trimmed.startsWith('### ')) {
            nodes.push({ type: 'h3', children: parseInlineFormatting(trimmed.slice(4)) })
        } else if (trimmed.startsWith('## ')) {
            nodes.push({ type: 'h2', children: parseInlineFormatting(trimmed.slice(3)) })
        } else if (trimmed.startsWith('# ')) {
            nodes.push({ type: 'h1', children: parseInlineFormatting(trimmed.slice(2)) })
        } else if (trimmed.startsWith('> ')) {
            nodes.push({ type: 'blockquote', children: [{ text: trimmed.slice(2) }] })
        } else if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
            nodes.push({ type: 'hr', children: [{ text: '' }] })
        } else {
            nodes.push({ type: 'p', children: parseInlineFormatting(trimmed) })
        }
    }

    return nodes.length > 0 ? nodes : [{ type: 'p', children: [{ text: '' }] }]
}

function parseInlineFormatting(text: string): unknown[] {
    const children: unknown[] = []
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

const TYPE_LABELS: Record<string, string> = {
    contract: 'Contract',
    memo: 'Legal Memo',
    brief: 'Brief',
    letter: 'Letter',
    motion: 'Motion',
    general: 'Document',
}

const TYPE_COLORS: Record<string, string> = {
    contract: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    memo: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    brief: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    letter: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    motion: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    general: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
}

export function DraftEditorPanel({
    isOpen,
    title,
    documentType,
    content,
    isStreaming,
    onClose,
}: DraftEditorPanelProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [savedDraftId, setSavedDraftId] = useState<string | null>(null)
    const [showEditor, setShowEditor] = useState(false)
    const [plateContent, setPlateContent] = useState<unknown[] | null>(null)
    const [wordCount, setWordCount] = useState(0)
    const contentRef = useRef<HTMLDivElement>(null)
    const prevContentLenRef = useRef(0)
    const autoSavedRef = useRef(false)

    // Auto-scroll during streaming
    useEffect(() => {
        if (contentRef.current && content.length > prevContentLenRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
        prevContentLenRef.current = content.length
    }, [content])

    // Update word count live
    useEffect(() => {
        if (content) {
            const plain = content.replace(/[#*_>`-]/g, '').trim()
            setWordCount(plain.split(/\s+/).filter(w => w.length > 0).length)
        }
    }, [content])

    // When streaming finishes, auto-save and switch to Plate editor
    useEffect(() => {
        if (!isStreaming && content && !autoSavedRef.current && !savedDraftId) {
            autoSavedRef.current = true
            const nodes = markdownToPlateNodes(content)
            setPlateContent(nodes)

            // Auto-save to DB
            const autoSave = async () => {
                try {
                    const plainText = content.replace(/[#*_>`-]/g, '').trim()
                    const wc = plainText.split(/\s+/).filter(w => w.length > 0).length

                    const res = await fetch('/api/drafts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: title || 'AI-Generated Draft',
                            content: nodes,
                            contentText: plainText,
                            documentType: documentType || 'general',
                            wordCount: wc,
                        }),
                    })

                    if (res.ok) {
                        const data = await res.json()
                        setSavedDraftId(data.draft.id)
                        // Short delay then switch to editor
                        setTimeout(() => setShowEditor(true), 300)
                    }
                } catch {
                    // Still show editor even if save fails
                    setTimeout(() => setShowEditor(true), 300)
                }
            }
            autoSave()
        }
    }, [isStreaming, content, title, documentType, savedDraftId])

    // Reset autoSaved when panel is re-opened with new content
    useEffect(() => {
        if (isStreaming) {
            autoSavedRef.current = false
            setShowEditor(false)
            setPlateContent(null)
            setSavedDraftId(null)
        }
    }, [isStreaming])

    const handleManualSave = useCallback(async () => {
        if (isSaving || !content) return
        setIsSaving(true)
        try {
            const nodes = plateContent || markdownToPlateNodes(content)
            const plainText = content.replace(/[#*_>`-]/g, '').trim()
            const wc = plainText.split(/\s+/).filter(w => w.length > 0).length

            if (savedDraftId) {
                // Update existing draft
                await fetch(`/api/drafts/${savedDraftId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title || 'AI-Generated Draft',
                        content: nodes,
                        contentText: plainText,
                        wordCount: wc,
                    }),
                })
                toast.success('Draft saved')
            } else {
                // Create new
                const res = await fetch('/api/drafts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title || 'AI-Generated Draft',
                        content: nodes,
                        contentText: plainText,
                        documentType: documentType || 'general',
                        wordCount: wc,
                    }),
                })
                if (res.ok) {
                    const data = await res.json()
                    setSavedDraftId(data.draft.id)
                    toast.success('Draft saved')
                }
            }
        } catch {
            toast.error('Failed to save draft')
        } finally {
            setIsSaving(false)
        }
    }, [content, plateContent, title, documentType, savedDraftId, isSaving])

    const handleOpenFullPage = useCallback(() => {
        if (savedDraftId) {
            router.push(`/drafts/${savedDraftId}`)
        }
    }, [savedDraftId, router])

    // Handle content changes from the Plate editor
    const handleEditorChange = useCallback((newContent: unknown[], plainText: string, wc: number) => {
        setPlateContent(newContent)
        setWordCount(wc)

        // Debounced save
        if (savedDraftId) {
            fetch(`/api/drafts/${savedDraftId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newContent,
                    contentText: plainText,
                    wordCount: wc,
                }),
            }).catch(() => { /* silent autosave */ })
        }
    }, [savedDraftId])

    if (!isOpen) return null

    const typeLabel = TYPE_LABELS[documentType] || 'Document'
    const typeColor = TYPE_COLORS[documentType] || TYPE_COLORS.general

    return (
        <div className="h-full flex flex-col border-l border-border bg-background animate-in slide-in-from-right-5 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                        <FileEdit className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">{title || 'Untitled Draft'}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider ${typeColor}`}>
                                {typeLabel}
                            </span>
                            {isStreaming && (
                                <span className="flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                    Writing...
                                </span>
                            )}
                            {!isStreaming && savedDraftId && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-2.5 w-2.5" />
                                    Saved
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {!isStreaming && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1.5"
                            onClick={handleManualSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                        </Button>
                    )}
                    {savedDraftId && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={handleOpenFullPage}
                        >
                            <Maximize2 className="h-3 w-3" />
                            Full Editor
                        </Button>
                    )}
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={onClose}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Editor Area — two modes: streaming preview OR full Plate editor */}
            {showEditor && plateContent ? (
                /* Full Plate.js editor — same as /drafts/[id] */
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <PlateEditor
                        initialContent={plateContent as never[]}
                        onContentChange={handleEditorChange}
                        documentType={documentType}
                    />
                </div>
            ) : (
                /* Streaming markdown preview */
                <>
                    <div
                        ref={contentRef}
                        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                    >
                        <div className="max-w-3xl mx-auto px-8 md:px-12 py-6 prose prose-sm dark:prose-invert
                            prose-headings:font-semibold prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-2
                            prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-6
                            prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-5
                            prose-p:leading-7 prose-p:mb-3 prose-p:text-[14px]
                            prose-strong:text-foreground
                            prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                            prose-ul:my-3 prose-ol:my-3 prose-li:my-0 prose-li:leading-7
                            prose-hr:my-6 prose-hr:border-border">
                            {content ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                            ) : (
                                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Preparing document...
                                </div>
                            )}
                            {isStreaming && content && (
                                <span className="inline-block w-0.5 h-5 bg-violet-500 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Footer */}
            <div className="px-4 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>{wordCount} words</span>
                {showEditor && (
                    <span className="text-[10px]">
                        Editing — changes auto-save
                    </span>
                )}
                {isStreaming && (
                    <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI is writing...
                    </span>
                )}
            </div>
        </div>
    )
}
