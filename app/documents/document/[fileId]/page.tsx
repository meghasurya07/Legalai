"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, Loader2, AlertCircle } from "lucide-react"

interface DocumentData {
    id: string
    name: string
    type: string
    size: string
    projectId: string
    content: string
    status: string
    uploadedAt: string
}

interface ChunkData {
    content: string
    chunkIndex: number
    fileName: string
    pageNumber: number | null
    sectionHeading: string | null
}

function DocumentViewerContent() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const fileId = Array.isArray(params.fileId) ? params.fileId[0] : (params.fileId as string)
    const chunkIndex = searchParams.get('ci')

    const [document, setDocument] = useState<DocumentData | null>(null)
    const [chunk, setChunk] = useState<ChunkData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const highlightRef = useRef<HTMLElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    // Fetch document content and chunk data
    useEffect(() => {
        if (!fileId) return

        const fetchData = async () => {
            setIsLoading(true)
            setError(null)

            try {
                // Fetch document and chunk in parallel
                const promises: Promise<Response>[] = [
                    fetch(`/api/documents/documents/${fileId}`)
                ]

                if (chunkIndex !== null) {
                    promises.push(fetch(`/api/documents/documents/${fileId}/chunk?index=${chunkIndex}`))
                }

                const responses = await Promise.all(promises)

                if (!responses[0].ok) {
                    throw new Error('Document not found')
                }

                const docData = await responses[0].json()
                setDocument(docData)

                if (responses[1] && responses[1].ok) {
                    const chunkData = await responses[1].json()
                    setChunk(chunkData)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load document')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [fileId, chunkIndex])

    // Auto-scroll to highlighted text after render
    useEffect(() => {
        if (!isLoading && highlightRef.current) {
            // Small delay to ensure DOM is painted
            const timer = setTimeout(() => {
                highlightRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                })
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [isLoading, chunk])

    // Render document content with highlighted chunk
    const renderContent = useCallback(() => {
        if (!document?.content) return null

        const fullText = document.content

        // If we have a chunk to highlight, find and highlight it
        if (chunk?.content) {
            const chunkText = chunk.content.trim()
            // Try to find the chunk content in the full document
            const startIdx = fullText.indexOf(chunkText)

            if (startIdx !== -1) {
                const before = fullText.substring(0, startIdx)
                const highlighted = fullText.substring(startIdx, startIdx + chunkText.length)
                const after = fullText.substring(startIdx + chunkText.length)

                return (
                    <>
                        {renderTextBlock(before, 'before')}
                        <mark
                            ref={highlightRef as React.RefObject<HTMLElement>}
                            className="citation-highlight"
                        >
                            {highlighted}
                        </mark>
                        {renderTextBlock(after, 'after')}
                    </>
                )
            }

            // If exact match fails, try a fuzzy match with first 100 chars
            const fuzzyText = chunkText.substring(0, 100)
            const fuzzyIdx = fullText.indexOf(fuzzyText)

            if (fuzzyIdx !== -1) {
                const before = fullText.substring(0, fuzzyIdx)
                const highlighted = fullText.substring(fuzzyIdx, fuzzyIdx + chunkText.length)
                const after = fullText.substring(fuzzyIdx + chunkText.length)

                return (
                    <>
                        {renderTextBlock(before, 'before')}
                        <mark
                            ref={highlightRef as React.RefObject<HTMLElement>}
                            className="citation-highlight"
                        >
                            {highlighted}
                        </mark>
                        {renderTextBlock(after, 'after')}
                    </>
                )
            }
        }

        // No highlighting — just render the full text
        return renderTextBlock(fullText, 'full')
    }, [document, chunk])

    // Helper to render text preserving paragraphs
    function renderTextBlock(text: string, key: string) {
        const paragraphs = text.split(/\n\n+/)
        return paragraphs.map((para, i) => {
            if (para.trim() === '') return null
            return (
                <p key={`${key}-${i}`} className="mb-4 leading-relaxed">
                    {para.split('\n').map((line, j) => (
                        <span key={`${key}-${i}-${j}`}>
                            {j > 0 && <br />}
                            {line}
                        </span>
                    ))}
                </p>
            )
        })
    }

    // Get file type badge color
    function getTypeBadge(type: string) {
        const ext = type.split('/').pop() || type
        const colorMap: Record<string, string> = {
            'pdf': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            'docx': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            'vnd.openxmlformats-officedocument.wordprocessingml.document': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            'csv': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            'plain': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
        }
        const label = ext.includes('wordprocessing') ? 'DOCX' : ext.toUpperCase()
        return (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorMap[ext] || 'bg-muted text-muted-foreground'}`}>
                {label}
            </span>
        )
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
        )
    }

    if (error || !document) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="h-10 w-10 text-destructive/60" />
                <h2 className="text-lg font-semibold">Document not found</h2>
                <p className="text-sm text-muted-foreground">{error || 'The requested document could not be loaded.'}</p>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        title="Go back"
                        className="shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary/70" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-semibold truncate">{document.name}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                {getTypeBadge(document.type)}
                                <span className="text-xs text-muted-foreground">{document.size}</span>
                                {chunk && (
                                    <>
                                        <span className="text-xs text-muted-foreground">•</span>
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                            Citation highlighted
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Citation Info Banner */}
            {chunk && (
                <div className="border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                    <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            <span className="font-medium">Cited passage</span>
                            {chunk.pageNumber && <> · Page {chunk.pageNumber}</>}
                            {chunk.sectionHeading && <> · {chunk.sectionHeading}</>}
                        </p>
                    </div>
                </div>
            )}

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto" ref={contentRef}>
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <article className="text-sm text-foreground/90 font-[var(--font-geist-sans)] whitespace-pre-wrap break-words">
                        {renderContent()}
                    </article>
                </div>
            </div>
        </div>
    )
}

export default function DocumentViewerPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <DocumentViewerContent />
        </Suspense>
    )
}
