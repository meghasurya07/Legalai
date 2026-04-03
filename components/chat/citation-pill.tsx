"use client"

import * as React from "react"
import { FileText } from "lucide-react"
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

export function CitationPill({
    citationNum,
    source,
    onViewPdf,
}: {
    citationNum: string
    source?: ChatCitationSource
    onOpenCitations?: () => void
    onViewPdf?: (source: ChatCitationSource, citationNum: string) => void
}) {
    const [faviconFailed, setFaviconFailed] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const pillRouter = useRouter()

    if (!source) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.75em] font-medium bg-muted text-muted-foreground mx-0.5">
                [{citationNum}]
            </span>
        )
    }

    const displayName = getCitationSourceDisplayName(source.url, source.title)
    const faviconUrl = getFaviconUrl(source.url)
    const isDocument = isDocumentSource(source.url)

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-full text-[13px] font-medium bg-muted/60 hover:bg-muted/80 text-foreground/80 hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-border/50 leading-none h-[22px]"
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
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
                            <FileText className="h-3 w-3 text-primary/70" />
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
                            <FileText className="h-3 w-3 text-primary/40" />
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
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
            >
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-full border border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                        {isDocument ? (
                            <FileText className="h-4 w-4 text-primary/70" />
                        ) : (
                            <SourceFavicon url={source.url} size={32} className="h-8 w-8 object-cover" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                            {isDocument ? 'Project Document' : displayName}
                        </div>
                        <h4 className="text-sm font-bold leading-tight line-clamp-2">
                            {source.title}
                        </h4>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 pt-0.5 leading-snug">
                            {source.snippet || (isDocument ? 'Document' : source.url)}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
