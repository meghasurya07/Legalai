"use client"

import * as React from "react"
import { X, FileText, ExternalLink, Globe, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import type { CitationEntry, CitationType } from "@/lib/citations"
import {
    ChatCitationSource,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
} from "@/lib/citations"
import { SourceFavicon } from "@/components/chat/source-favicon"

// ─── Types ────────────────────────────────────────────────────────

interface CitationsSidebarProps {
    isOpen: boolean
    sources: ChatCitationSource[]
    /** Rich citation entries (when available from structured format) */
    entries?: CitationEntry[]
    onClose: () => void
    onViewPdf?: (source: ChatCitationSource, citationNum: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────

function getTypeIcon(type: CitationType | string) {
    switch (type) {
        case 'rag': return FileText
        case 'web': return Globe
        case 'ai_knowledge': return Brain
        default: return FileText
    }
}

function getConfidenceDot(confidence: number) {
    if (confidence >= 0.8) return { color: 'bg-emerald-500', label: 'High confidence' }
    if (confidence >= 0.5) return { color: 'bg-amber-500', label: 'Medium confidence' }
    return { color: 'bg-red-400', label: 'Low confidence' }
}

function getTypeLabel(type: CitationType | string) {
    switch (type) {
        case 'rag': return 'Project Document'
        case 'web': return 'Web Source'
        case 'ai_knowledge': return 'AI Knowledge'
        default: return 'Source'
    }
}

// ─── Grouped entry view ──────────────────────────────────────────

interface SourceGroup {
    key: string
    type: CitationType
    title: string
    url: string
    isDoc: boolean
    entries: CitationEntry[]
    avgConfidence: number
}

function groupEntries(entries: CitationEntry[]): SourceGroup[] {
    const groups = new Map<string, SourceGroup>()

    for (const entry of entries) {
        // Group by fileId (for RAG) or URL domain (for web)
        const groupKey = entry.metadata.fileId || entry.url
        const existing = groups.get(groupKey)

        if (existing) {
            existing.entries.push(entry)
            existing.avgConfidence = (existing.avgConfidence * (existing.entries.length - 1) + entry.confidence) / existing.entries.length
        } else {
            const baseTitle = entry.title.split(' — ')[0] || entry.title
            groups.set(groupKey, {
                key: groupKey,
                type: entry.type,
                title: baseTitle,
                url: entry.url,
                isDoc: isDocumentSource(entry.url),
                entries: [entry],
                avgConfidence: entry.confidence,
            })
        }
    }

    return Array.from(groups.values())
}

// ─── Component ────────────────────────────────────────────────────

export function CitationsSidebar({ isOpen, sources, entries, onClose, onViewPdf }: CitationsSidebarProps) {
    const isMobile = useIsMobile()

    if (!isOpen && !isMobile) return null

    // Use structured entries if available, otherwise fallback to legacy sources
    const hasEntries = entries && entries.length > 0
    const sourceGroups = hasEntries ? groupEntries(entries) : null

    const content = (
        <div className={isMobile ? "flex flex-col h-full bg-background" : "w-[370px] h-full border-l bg-background flex flex-col shadow-sm animate-in slide-in-from-right duration-300 shrink-0"}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-base">Citations</h2>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {hasEntries ? entries.length : sources.length}
                    </span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Citation list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* ── Structured entries (grouped) ── */}
                {sourceGroups && sourceGroups.length > 0 ? (
                    sourceGroups.map((group) => {
                        const Icon = getTypeIcon(group.type)
                        const conf = getConfidenceDot(group.avgConfidence)
                        const route = group.isDoc ? getDocumentRoute(group.url) : null

                        return (
                            <div key={group.key} className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                                {/* Group header */}
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border/30">
                                    <div className="h-5 w-5 rounded-sm overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                        {group.isDoc ? (
                                            <Icon className="h-3.5 w-3.5 text-blue-500" />
                                        ) : (
                                            <SourceFavicon url={group.url} size={20} className="h-5 w-5 object-contain" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                            {getTypeLabel(group.type)}
                                        </span>
                                        <h3 className="text-sm font-semibold leading-tight truncate">
                                            {group.title}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {group.entries.length > 1 && (
                                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                                cited {group.entries.length}×
                                            </span>
                                        )}
                                        <div className={`h-2 w-2 rounded-full ${conf.color}`} title={conf.label} />
                                    </div>
                                </div>

                                {/* Individual citations within the group */}
                                <div className="divide-y divide-border/30">
                                    {group.entries.map((entry, i) => {
                                        const entryConf = getConfidenceDot(entry.confidence)
                                        return (
                                            <div
                                                key={`${entry.id}-${i}`}
                                                className="px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                                                onClick={() => {
                                                    const src: ChatCitationSource = {
                                                        num: String(entry.num),
                                                        title: entry.title,
                                                        url: entry.url,
                                                        snippet: entry.snippet,
                                                    }
                                                    if (group.isDoc && onViewPdf) {
                                                        onClose()
                                                        onViewPdf(src, String(entry.num))
                                                    } else if (group.isDoc && route) {
                                                        onClose()
                                                        window.location.href = route
                                                    } else if (!group.isDoc) {
                                                        window.open(entry.url, '_blank', 'noopener,noreferrer')
                                                    }
                                                }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                                                        {entry.num}
                                                    </span>
                                                    <div className="flex-1 min-w-0 space-y-0.5">
                                                        {/* Page / Section metadata */}
                                                        {(entry.metadata.pageNumber || entry.metadata.sectionHeading) && (
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-medium">
                                                                {entry.metadata.pageNumber && <span>Page {entry.metadata.pageNumber}</span>}
                                                                {entry.metadata.pageNumber && entry.metadata.sectionHeading && <span>·</span>}
                                                                {entry.metadata.sectionHeading && <span className="truncate">{entry.metadata.sectionHeading}</span>}
                                                                <div className={`h-1.5 w-1.5 rounded-full ${entryConf.color} ml-auto shrink-0`} title={entryConf.label} />
                                                            </div>
                                                        )}
                                                        {/* Snippet */}
                                                        <p className="text-[12px] text-muted-foreground/80 line-clamp-2 leading-snug group-hover:text-foreground/70 transition-colors">
                                                            {entry.snippet || 'No preview available'}
                                                        </p>
                                                    </div>
                                                    {!group.isDoc && (
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors mt-1 shrink-0" />
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })
                ) : sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center mt-10">No citations found for this message.</p>
                ) : (
                    /* ── Legacy flat list (fallback) ── */
                    sources.map((src, idx) => {
                        const isDoc = isDocumentSource(src.url)
                        const route = isDoc ? getDocumentRoute(src.url) : null

                        const inner = (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-sm overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                        {isDoc ? (
                                            <FileText className="h-3.5 w-3.5 text-blue-500" />
                                        ) : (
                                            <SourceFavicon url={src.url} size={20} className="h-5 w-5 object-contain" />
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                        {isDoc ? 'Project Document' : getCitationSourceDisplayName(src.url, src.title)}
                                    </span>
                                    {!isDoc && (
                                        <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors ml-auto" />
                                    )}
                                </div>
                                <h3 className="text-sm font-bold leading-tight group-hover:text-primary transition-colors line-clamp-3">
                                    {src.title}
                                </h3>
                                <p className="text-[12px] text-muted-foreground/70 line-clamp-3 leading-snug">
                                    {src.snippet || (isDoc ? 'Document' : src.url)}
                                </p>
                            </>
                        )

                        if (isDoc) {
                            return (
                                <div
                                    key={idx}
                                    className="group block space-y-2 border-b border-border/40 pb-5 last:border-0 cursor-pointer"
                                    onClick={() => {
                                        if (onViewPdf) {
                                            onClose()
                                            onViewPdf(src, src.num)
                                        } else if (route) {
                                            onClose()
                                            window.location.href = route
                                        }
                                    }}
                                >
                                    {inner}
                                </div>
                            )
                        }

                        return (
                            <a
                                key={idx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group block space-y-2 border-b border-border/40 pb-5 last:border-0"
                            >
                                {inner}
                            </a>
                        )
                    })
                )}
            </div>
        </div>
    )

    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <SheetContent side="right" className="w-full sm:max-w-full p-0 [&>button]:hidden">
                    <SheetTitle className="sr-only">Citations</SheetTitle>
                    {content}
                </SheetContent>
            </Sheet>
        )
    }

    return content
}
