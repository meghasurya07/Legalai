/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import { X, FileText, ZoomIn, ZoomOut, Maximize2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PdfViewer } from "@/components/pdf-viewer"
import type { ChatCitationSource } from "@/lib/citations"

// ─── Types ────────────────────────────────────────────────────────

export interface PdfCitationTarget {
    fileId: string
    fileName: string
    fileUrl: string | null
    snippet: string
    pageNumber: number | null
    chunkIndex: number
    citationNum: string
}

interface PdfCitationPanelProps {
    /** Currently active citation to show */
    target: PdfCitationTarget | null
    /** All parsed sources from the message for the citation strip */
    sources: ChatCitationSource[]
    /** Close the panel */
    onClose: () => void
    /** User clicked a different citation in the strip */
    onCitationClick?: (source: ChatCitationSource) => void
}

// ─── Document Text Viewer ─────────────────────────────────────────
// Fetches extracted text from the API and renders the full content
// with the matching passage highlighted in yellow.

function DocTextViewer({
    fileId,
    highlightText,
}: {
    fileId: string
    highlightText: string
}) {
    const [text, setText] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Fetch extracted text
    React.useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        async function fetchText() {
            try {
                const res = await fetch(`/api/documents/${fileId}/text`)
                if (!res.ok) throw new Error(`Failed to fetch text: ${res.status}`)
                const data = await res.json()
                if (!cancelled) {
                    setText(data.text || '')
                }
            } catch (err) {
                if (!cancelled) setError('Failed to load document text')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchText()
        return () => { cancelled = true }
    }, [fileId])

    // Scroll to highlighted section after render
    React.useEffect(() => {
        if (!text || !containerRef.current) return
        const timer = setTimeout(() => {
            const highlighted = containerRef.current?.querySelector('.doc-highlight-active')
            if (highlighted) {
                highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [text, highlightText])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
        )
    }

    if (error || !text) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{error || 'No text available'}</p>
            </div>
        )
    }

    // Build highlighted HTML by finding the snippet in the full text
    const renderHighlightedText = () => {
        if (!highlightText || highlightText.length < 20) {
            return <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{text}</pre>
        }

        // Build an index map mapping normalized text indices back to original text indices
        let normalizedText = ''
        let isSpace = false
        const indexMap: number[] = []

        // To handle leading whitespace appropriately
        const trimmedOriginalMatch = text.match(/^\s+/)
        if (trimmedOriginalMatch) {
            // we will skip mapping leading spaces into `normalizedText` or handle them carefully
        }

        for (let i = 0; i < text.length; i++) {
            const char = text[i]
            if (/\s/.test(char)) {
                if (!isSpace) {
                    // Only add a single space to normalized text if we haven't just added one
                    if (normalizedText.length > 0) { // skip leading spaces entirely
                        normalizedText += ' '
                        indexMap.push(i)
                        isSpace = true
                    }
                }
            } else {
                normalizedText += char
                indexMap.push(i)
                isSpace = false
            }
        }
        indexMap.push(text.length)

        const normalizedSnippet = highlightText.replace(/\s+/g, ' ').trim()

        // Try progressively shorter snippets for matching
        let matchIndex = -1
        let matchLength = 0
        const searchLengths = [
            Math.min(normalizedSnippet.length, 200),
            Math.min(normalizedSnippet.length, 100),
            Math.min(normalizedSnippet.length, 60),
            Math.min(normalizedSnippet.length, 30),
        ]

        for (const len of searchLengths) {
            if (len < 15) continue
            const searchStr = normalizedSnippet.substring(0, len).toLowerCase()
            const idx = normalizedText.toLowerCase().indexOf(searchStr)
            if (idx !== -1) {
                matchIndex = idx
                // Extend match to full snippet length if possible
                matchLength = Math.min(normalizedSnippet.length, normalizedText.length - idx)
                break
            }
        }

        if (matchIndex === -1) {
            // No match found, show text with snippet callout at top
            return (
                <div>
                    <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                        <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-1">
                            Cited Passage
                        </p>
                        <p className="text-sm text-yellow-900 dark:text-yellow-200 leading-relaxed italic">
                            &ldquo;{highlightText.substring(0, 300)}{highlightText.length > 300 ? '…' : ''}&rdquo;
                        </p>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{text}</pre>
                </div>
            )
        }

        // Split original text using mapped indices
        const originalStart = indexMap[matchIndex]
        const originalEnd = indexMap[Math.min(matchIndex + matchLength, indexMap.length - 1)]

        const before = text.substring(0, originalStart)
        const match = text.substring(originalStart, originalEnd)
        const after = text.substring(originalEnd)

        return (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                {before}
                <mark className="doc-highlight-active bg-yellow-200 dark:bg-yellow-700/50 px-0.5 rounded-sm">{match}</mark>
                {after}
            </pre>
        )
    }

    return (
        <div ref={containerRef} className="h-full overflow-y-auto p-6 bg-white dark:bg-neutral-900">
            {renderHighlightedText()}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────

export function PdfCitationPanel({ target, sources, onClose, onCitationClick }: PdfCitationPanelProps) {
    const [zoom, setZoom] = React.useState(1.0)
    const [pageCount, setPageCount] = React.useState<number | null>(null)
    const [pdfError, setPdfError] = React.useState(false)

    // Reset zoom when target changes
    React.useEffect(() => {
        setZoom(1.0)
        setPageCount(null)
        setPdfError(false)
    }, [target?.fileId, target?.chunkIndex])

    if (!target) return null

    const pdfUrl = `/api/documents/${target.fileId}/pdf`
    const fileName = target.fileName?.toLowerCase() || ''
    const isPdf = fileName.endsWith('.pdf')
    const isDocx = fileName.endsWith('.docx') || fileName.endsWith('.doc')
    const fileType = isPdf ? 'PDF' : isDocx ? 'Word Document' : 'Document'

    const zoomIn = () => setZoom(z => Math.min(z + 0.25, 3.0))
    const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5))
    const fitWidth = () => setZoom(1.0)

    return (
        <div className="w-[520px] h-full border-l bg-background flex flex-col shadow-lg animate-in slide-in-from-right duration-300 shrink-0">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-md ${isPdf ? 'bg-red-500/10' : isDocx ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
                        <FileText className={`h-4 w-4 ${isPdf ? 'text-red-500' : isDocx ? 'text-blue-500' : 'text-primary'}`} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold truncate">{target.fileName || "Document"}</h2>
                        <p className="text-[10px] text-muted-foreground">
                            {fileType}
                            {target.pageNumber ? ` · Page ${target.pageNumber}` : ""}
                            {target.pageNumber && pageCount ? ` of ${pageCount}` : ""}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* ── Citation Strip ── */}
            {sources.length > 1 && (
                <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-none shrink-0 bg-muted/10">
                    {sources.map((src, i) => {
                        const isActive = src.num === target.citationNum
                        return (
                            <button
                                key={`${src.num}-${i}`}
                                onClick={() => onCitationClick?.(src)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ${isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                            >
                                <FileText className="h-3 w-3" />
                                [{src.num}]
                            </button>
                        )
                    })}
                </div>
            )}

            {/* ── Zoom Controls (PDF only) ── */}
            {isPdf && (
                <div className="flex items-center justify-center gap-1 px-3 py-1.5 border-b shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoom <= 0.5}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[11px] text-muted-foreground w-12 text-center tabular-nums">
                        {Math.round(zoom * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoom >= 3.0}>
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitWidth} title="Fit width">
                        <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}

            {/* ── Document Viewer ── */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {isPdf && !pdfError ? (
                    <PdfViewer
                        url={pdfUrl}
                        highlightText={target.snippet}
                        initialPage={target.pageNumber || undefined}
                        zoom={zoom}
                        onPageCountChange={setPageCount}
                        className="h-full"
                    />
                ) : (
                    /* Text-based viewer for DOCX, TXT, CSV, and other file types */
                    <DocTextViewer
                        fileId={target.fileId}
                        highlightText={target.snippet}
                    />
                )}
            </div>

            {/* ── Snippet Quote Bar ── */}
            {target.snippet && (
                <div className="shrink-0 border-t bg-muted/20 px-4 py-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Cited Passage
                    </p>
                    <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
                        &ldquo;{target.snippet.substring(0, 250)}{target.snippet.length > 250 ? "…" : ""}&rdquo;
                    </p>
                </div>
            )}
        </div>
    )
}
