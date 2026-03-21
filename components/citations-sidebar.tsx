"use client"

import * as React from "react"
import { X, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    ChatCitationSource,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
} from "@/lib/citations"
import { SourceFavicon } from "@/components/chat-interface"

interface CitationsSidebarProps {
    isOpen: boolean
    sources: ChatCitationSource[]
    onClose: () => void
    onViewPdf?: (source: ChatCitationSource, citationNum: string) => void
}

export function CitationsSidebar({ isOpen, sources, onClose, onViewPdf }: CitationsSidebarProps) {
    if (!isOpen) return null

    return (
        <div className="w-[350px] h-full border-l bg-background flex flex-col shadow-sm animate-in slide-in-from-right duration-300 shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <h2 className="font-semibold text-base">Citations</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center mt-10">No citations found for this message.</p>
                ) : (
                    sources.map((src, idx) => {
                        const isDoc = isDocumentSource(src.url)
                        const route = isDoc ? getDocumentRoute(src.url) : null

                        const inner = (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-sm overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                        {isDoc ? (
                                            <FileText className="h-3.5 w-3.5 text-primary/70" />
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
}
