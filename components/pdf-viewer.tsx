/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────
export interface PdfHighlight {
    page: number
    rects: { left: number; top: number; width: number; height: number }[]
}

interface PdfViewerProps {
    /** URL to fetch the PDF binary from */
    url: string
    /** Text snippet to search and highlight in the PDF */
    highlightText?: string
    /** Page to scroll to initially (1-indexed) */
    initialPage?: number
    /** Zoom level (1= 100%) */
    zoom?: number
    /** Called when total page count is determined */
    onPageCountChange?: (count: number) => void
    /** CSS classes */
    className?: string
}

// ─── Constants ────────────────────────────────────────────────────
const WORKER_SRC = "/pdf.worker.min.mjs"
const CMAP_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/cmaps/"

// Base scale multiplier for rendering clarity
const BASE_SCALE = 1.5

// ─── Component ────────────────────────────────────────────────────
export function PdfViewer({
    url,
    highlightText,
    initialPage,
    zoom = 1.0,
    onPageCountChange,
    className,
}: PdfViewerProps) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    // Load and render the PDF
    React.useEffect(() => {
        let cancelled = false

        const loadPdf = async () => {
            try {
                setLoading(true)
                setError(null)

                // Dynamic import to avoid SSR issues
                const pdfjsLib = await import("pdfjs-dist")
                pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC

                const loadingTask = pdfjsLib.getDocument({
                    url,
                    cMapUrl: CMAP_URL,
                    cMapPacked: true,
                })

                const pdf = await loadingTask.promise
                if (cancelled) return

                const numPages = pdf.numPages
                onPageCountChange?.(numPages)

                const container = containerRef.current
                if (!container) return

                // Clear previous renders and reset scroll
                container.innerHTML = ""
                container.scrollTop = 0

                let firstHighlightEl: HTMLElement | null = null

                // Render all pages
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    if (cancelled) return

                    const page = await pdf.getPage(pageNum)
                    const scale = zoom * BASE_SCALE
                    const viewport = page.getViewport({ scale })

                    // ── Page wrapper ──
                    const pageDiv = document.createElement("div")
                    pageDiv.className = "pdf-page-wrapper"
                    pageDiv.dataset.pageNumber = String(pageNum)
                    Object.assign(pageDiv.style, {
                        position: "relative",
                        width: `${viewport.width}px`,
                        height: `${viewport.height}px`,
                        margin: "0 auto 16px auto",
                        background: "white",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                        borderRadius: "4px",
                        overflow: "hidden",
                    })

                    // ── Canvas for PDF rendering ──
                    const canvas = document.createElement("canvas")
                    canvas.width = viewport.width
                    canvas.height = viewport.height
                    Object.assign(canvas.style, {
                        width: `${viewport.width}px`,
                        height: `${viewport.height}px`,
                        display: "block",
                    })
                    pageDiv.appendChild(canvas)

                    const ctx = canvas.getContext("2d")
                    if (ctx) {
                        await page.render({
                            canvasContext: ctx,
                            viewport,
                            canvas,
                        } as unknown as Parameters<typeof page.render>[0]).promise
                    }

                    // ── Text layer using PDF.js built-in TextLayer ──
                    // This gives pixel-perfect text positioning using actual font metrics
                    const textContent = await page.getTextContent()
                    const textLayerDiv = document.createElement("div")
                    textLayerDiv.className = "textLayer"
                    pageDiv.appendChild(textLayerDiv)

                    // Use PDF.js's built-in TextLayer for pixel-perfect positioning
                    const textLayer = new pdfjsLib.TextLayer({
                        textContentSource: textContent,
                        container: textLayerDiv,
                        viewport: viewport,
                    })
                    await textLayer.render()

                    // ── Highlight matching text ──
                    if (highlightText && highlightText.length > 10) {
                        const highlighted = highlightMatchingSpans(
                            textLayerDiv,
                            highlightText
                        )
                        if (highlighted && !firstHighlightEl) {
                            firstHighlightEl = highlighted
                        }
                    }

                    container.appendChild(pageDiv)
                }

                if (!cancelled) {
                    setLoading(false)

                    // Scroll to the highlighted area or initialPage
                    requestAnimationFrame(() => {
                        if (firstHighlightEl) {
                            setTimeout(() => {
                                firstHighlightEl!.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                })
                            }, 100)
                        } else if (initialPage) {
                            const pageEl = container.querySelector(
                                `[data-page-number="${initialPage}"]`
                            ) as HTMLElement | null
                            if (pageEl) {
                                pageEl.scrollIntoView({ behavior: "smooth", block: "start" })
                            }
                        }
                    })
                }
            } catch (err) {
                if (!cancelled) {
                    setError("Failed to load PDF")
                    setLoading(false)
                }
            }
        }

        loadPdf()
        return () => { cancelled = true }
    }, [url, highlightText, initialPage, zoom, onPageCountChange])

    if (error) {
        return (
            <div className={`flex items-center justify-center h-full ${className || ""}`}>
                <p className="text-sm text-muted-foreground">{error}</p>
            </div>
        )
    }

    return (
        <div className={`relative h-full ${className || ""}`}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Loading PDF…</span>
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="h-full overflow-y-auto overflow-x-auto p-4 bg-muted/30 scroll-smooth"
            />
        </div>
    )
}

// ─── Text Highlight Matching (DOM-based, pixel-perfect) ──────────

/**
 * Walk through the TextLayer's rendered spans and highlight those
 * whose text matches the search snippet. Returns the first highlighted
 * element for scroll-into-view, or null if nothing matched.
 */
function highlightMatchingSpans(
    textLayerDiv: HTMLElement,
    searchText: string
): HTMLElement | null {
    // Build full page text from all spans
    const spans = Array.from(textLayerDiv.querySelectorAll("span")) as HTMLSpanElement[]
    if (spans.length === 0) return null

    // Build running text with span index tracking
    const spanRanges: { start: number; end: number; span: HTMLSpanElement }[] = []
    let runningText = ""

    for (const span of spans) {
        const text = span.textContent || ""
        if (!text.trim()) continue
        const start = runningText.length
        runningText += text + " "
        spanRanges.push({ start, end: runningText.length - 1, span })
    }

    // Build an index map mapping normalized text indices back to original chunk string
    let normalizedPage = ""
    let isSpace = false
    const indexMap: number[] = []

    for (let i = 0; i < runningText.length; i++) {
        const char = runningText[i]
        if (/\s/.test(char)) {
            if (!isSpace) {
                // Only add a single space to normalized text if we haven't just added one
                if (normalizedPage.length > 0) {
                    normalizedPage += " "
                    indexMap.push(i)
                    isSpace = true
                }
            }
        } else {
            normalizedPage += char.toLowerCase()
            indexMap.push(i)
            isSpace = false
        }
    }
    indexMap.push(runningText.length)

    const normalizedSearch = searchText.replace(/\s+/g, " ").trim().toLowerCase()

    // Try progressively shorter snippets for matching to handle PDF.js extraction anomalies
    const searchLengths = [
        Math.min(normalizedSearch.length, 200),
        Math.min(normalizedSearch.length, 100),
        Math.min(normalizedSearch.length, 60),
        Math.min(normalizedSearch.length, 30),
    ]

    let matchIndex = -1
    let matchLength = 0

    for (const len of searchLengths) {
        if (len < 15) continue
        const fragment = normalizedSearch.substring(0, len)
        matchIndex = normalizedPage.indexOf(fragment)
        if (matchIndex !== -1) {
            matchLength = Math.min(normalizedSearch.length, normalizedPage.length - matchIndex)
            break
        }
    }

    if (matchIndex === -1) return null

    const originalStart = indexMap[matchIndex]
    const originalEnd = indexMap[Math.min(matchIndex + matchLength, indexMap.length - 1)]

    let firstHighlighted: HTMLElement | null = null

    // Highlight spans that overlap with the match range
    for (const { start, end, span } of spanRanges) {
        if (end > originalStart && start < originalEnd) {
            // This span overlaps with the matched text — highlight it
            span.style.backgroundColor = "rgba(250, 204, 21, 0.4)"
            span.style.borderRadius = "2px"
            span.style.mixBlendMode = "multiply"
            span.classList.add("pdf-highlight-active")

            if (!firstHighlighted) {
                firstHighlighted = span
            }
        }
    }

    return firstHighlighted
}
