"use client"

import * as React from "react"
import { X, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    ChatCitationSource,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
} from "@/lib/citations"
import { SourceFavicon } from "@/components/chat-interface"

interface ActivitySidebarProps {
    isOpen: boolean
    duration: number | null
    entries: { phase: string; detail: string; time: Date }[]
    sources: ChatCitationSource[]
    isThinkingMode: boolean
    onClose: () => void
}



export function ActivitySidebar({ isOpen, duration, entries, sources, isThinkingMode, onClose }: ActivitySidebarProps) {
    if (!isOpen) return null

    const durationLabel = duration ? `${duration}s` : '...'

    return (
        <div className="w-[380px] h-full border-l bg-background flex flex-col shadow-sm animate-in slide-in-from-right duration-300 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-base">Activity</h2>
                    <span className="text-sm text-muted-foreground">· {durationLabel}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Thinking Section */}
                <div className="px-5 py-4">
                    <h3 className="text-sm font-semibold mb-4">{isThinkingMode ? 'Thinking' : 'Searching'}</h3>
                    <div className="space-y-4">
                        {entries.map((entry, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground/90 leading-tight">
                                        {entry.detail}
                                    </p>
                                    {/* Show domain badges for search entries */}
                                    {entry.phase === 'searching_web' && entry.detail.includes('http') && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {extractDomains(entry.detail).map((domain, di) => (
                                                <span key={di} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-[11px] text-muted-foreground">
                                                    <SourceFavicon url={`https://${domain}`} size={12} className="rounded-sm" />
                                                    {domain}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Completion status */}
                    {duration && (
                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/40">
                            <div className="h-5 w-5 rounded-full bg-foreground flex items-center justify-center shrink-0">
                                <Check className="h-3 w-3 text-background stroke-[3]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                    {isThinkingMode ? `Thought for ${duration}s` : `Searched for ${duration}s`}
                                </span>
                                <span className="text-xs text-muted-foreground">Done</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sources Section */}
                {sources.length > 0 && (
                    <div className="px-5 py-4 border-t border-border/40">
                        <h3 className="text-sm font-semibold mb-4">
                            Sources · {sources.length}
                        </h3>
                        <div className="space-y-3">
                            {sources.map((src, idx) => {
                                const isDoc = isDocumentSource(src.url)
                                const route = isDoc ? getDocumentRoute(src.url) : null

                                return (
                                    <a
                                        key={idx}
                                        href={isDoc && route ? route : src.url}
                                        target={isDoc ? undefined : "_blank"}
                                        rel={isDoc ? undefined : "noopener noreferrer"}
                                        className="group block p-3 rounded-lg border border-border/40 hover:border-border hover:bg-muted/30 transition-all"
                                        onClick={isDoc && route ? (e) => { e.preventDefault(); onClose(); window.location.href = route } : undefined}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="h-4 w-4 rounded-sm overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                                {isDoc ? (
                                                    <FileText className="h-3 w-3 text-primary/70" />
                                                ) : (
                                                    <SourceFavicon url={src.url} size={16} className="h-4 w-4 object-contain" />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                                {isDoc ? 'Document' : getCitationSourceDisplayName(src.url, src.title)}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                            {src.title}
                                        </h4>
                                        {src.snippet && (
                                            <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mt-1 leading-snug">
                                                {src.snippet}
                                            </p>
                                        )}
                                    </a>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function extractDomains(text: string): string[] {
    const urlRegex = /https?:\/\/([^\/\s]+)/g
    const matches = text.matchAll(urlRegex)
    return Array.from(new Set(Array.from(matches).map(m => m[1])))
}
