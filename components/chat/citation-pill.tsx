"use client"

import * as React from "react"
import { FileText, Globe, Brain } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SourceFavicon } from "@/components/chat/source-favicon"
import {
    ChatCitationSource,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
    getFaviconUrl,
} from "@/lib/citations"
import type { CitationType } from "@/lib/citations"

// ─── Source-type config ─────────────────────────────────────────
interface TypeConfig {
    pillClass: string
    icon: React.ElementType
    label: string
}

const TYPE_CONFIG: Record<CitationType | 'default', TypeConfig> = {
    rag: { pillClass: 'cite-pill-rag', icon: FileText, label: 'Project Document' },
    web: { pillClass: 'cite-pill-web', icon: Globe, label: 'Web Source' },
    ai_knowledge: { pillClass: 'cite-pill-ai', icon: Brain, label: 'AI Knowledge' },
    default: { pillClass: 'cite-pill-rag', icon: FileText, label: 'Source' },
}

// ─── Snippet highlighting ───────────────────────────────────────

/** Highlight the most relevant phrase from the snippet that overlaps
 *  with meaningful keywords. Uses sentence-boundary-aware matching. */
function highlightSnippet(snippet: string, title: string): React.ReactNode {
    if (!snippet || !title) return snippet

    // Extract significant words (4+ chars, not common stopwords)
    const stopwords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'will', 'shall', 'which', 'their', 'there', 'about', 'other', 'than', 'into', 'more', 'some', 'such', 'each', 'made', 'after', 'also', 'upon'])
    const keywords = title
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopwords.has(w))

    if (keywords.length === 0) return snippet

    // Build a regex that matches any keyword (word-boundary, case-insensitive)
    const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = snippet.split(pattern)

    if (parts.length === 1) return snippet

    return parts.map((part, idx) => {
        if (pattern.test(part)) {
            // Reset lastIndex because we reuse the regex
            pattern.lastIndex = 0
            return React.createElement('mark', {
                key: idx,
                className: 'bg-yellow-200/60 dark:bg-yellow-500/20 text-foreground rounded-sm px-0.5 font-medium',
            }, part)
        }
        // Reset lastIndex for subsequent test calls
        pattern.lastIndex = 0
        return part
    })
}

// ─── Component ──────────────────────────────────────────────────

export function CitationPill({
    citationNum,
    source,
    onViewPdf,
    confidence,
    metadata,
    citationType,
}: {
    citationNum: string
    source?: ChatCitationSource
    onOpenCitations?: () => void
    onViewPdf?: (source: ChatCitationSource, citationNum: string) => void
    /** Attribution confidence 0-1. Below 0.7, pill renders dimmed. */
    confidence?: number
    /** Optional rich metadata for page/section display */
    metadata?: {
        pageNumber?: number
        sectionHeading?: string
    }
    /** Source type for color coding */
    citationType?: CitationType
}) {
    const isLowConfidence = confidence !== undefined && confidence < 0.7
    const [faviconFailed, setFaviconFailed] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const pillRouter = useRouter()
    const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    // Determine source type for color coding
    const isDocument = source ? isDocumentSource(source.url) : false
    const resolvedType: CitationType | 'default' = citationType || (isDocument ? 'rag' : source ? 'web' : 'default')
    const typeConfig = TYPE_CONFIG[resolvedType] || TYPE_CONFIG.default
    const TypeIcon = typeConfig.icon

    // Delayed open/close for smooth hover (Harvey/Perplexity pattern)
    const handleMouseEnter = React.useCallback(() => {
        if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
        openTimerRef.current = setTimeout(() => setIsOpen(true), 200)
    }, [])

    const handleMouseLeave = React.useCallback(() => {
        if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
        closeTimerRef.current = setTimeout(() => setIsOpen(false), 300)
    }, [])

    // Cleanup timers on unmount
    React.useEffect(() => {
        return () => {
            if (openTimerRef.current) clearTimeout(openTimerRef.current)
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        }
    }, [])

    if (!source) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.75em] font-medium bg-muted text-muted-foreground mx-0.5">
                [{citationNum}]
            </span>
        )
    }

    const displayName = getCitationSourceDisplayName(source.url, source.title)
    const faviconUrl = getFaviconUrl(source.url)

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={`cite-pill-interactive inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full text-[13px] font-medium cursor-pointer border leading-none h-[22px] ${typeConfig.pillClass} ${isLowConfidence ? 'opacity-60 border-dashed' : ''}`}
                    style={{
                        backgroundColor: 'var(--cite-bg)',
                        borderColor: isLowConfidence ? 'var(--cite-border)' : 'var(--cite-border)',
                        color: 'var(--cite-text)',
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (isDocument && onViewPdf) {
                            onViewPdf(source, citationNum)
                        } else if (isDocument) {
                            const route = getDocumentRoute(source.url)
                            if (route) {
                                pillRouter.push(route)
                            }
                        } else {
                            window.open(source.url, '_blank', 'noopener,noreferrer')
                        }
                    }}
                    aria-label={`Citation ${citationNum}: ${source.title}`}
                >
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-sm shrink-0 relative">
                        {isDocument ? (
                            <TypeIcon className="h-3 w-3" style={{ color: 'var(--cite-text)' }} />
                        ) : faviconUrl && !faviconFailed ? (
                            <Image
                                src={faviconUrl}
                                alt=""
                                width={14}
                                height={14}
                                className="h-3.5 w-3.5 rounded-sm object-contain"
                                unoptimized
                                onError={() => setFaviconFailed(true)}
                            />
                        ) : (
                            <TypeIcon className="h-3 w-3" style={{ color: 'var(--cite-text)' }} />
                        )}
                    </span>
                    <span className="truncate max-w-[120px]">{displayName}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-3 shadow-xl rounded-xl bg-background border border-border"
                side="top"
                align="center"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-8 w-8 rounded-full border flex items-center justify-center shrink-0 overflow-hidden ${typeConfig.pillClass}`}
                         style={{ borderColor: 'var(--cite-border)', backgroundColor: 'var(--cite-bg)' }}>
                        {isDocument ? (
                            <TypeIcon className="h-4 w-4" style={{ color: 'var(--cite-text)' }} />
                        ) : (
                            <SourceFavicon url={source.url} size={32} className="h-8 w-8 object-cover" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                            <span>{typeConfig.label}</span>
                            {isLowConfidence && (
                                <span className="text-[9px] text-amber-500/80 font-semibold normal-case tracking-normal">⚠ Low confidence</span>
                            )}
                        </div>
                        <h4 className="text-sm font-bold leading-tight line-clamp-2">
                            {source.title}
                        </h4>
                        {metadata?.pageNumber || metadata?.sectionHeading ? (
                            <div className="text-[10px] text-muted-foreground/70 font-medium flex items-center gap-1">
                                {metadata.pageNumber && <span>Page {metadata.pageNumber}</span>}
                                {metadata.pageNumber && metadata.sectionHeading && <span>·</span>}
                                {metadata.sectionHeading && <span>{metadata.sectionHeading}</span>}
                            </div>
                        ) : null}
                        <div className="text-[11px] text-muted-foreground line-clamp-3 pt-0.5 leading-snug">
                            {source.snippet
                                ? highlightSnippet(source.snippet, source.title)
                                : (isDocument ? 'Document' : source.url)}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
