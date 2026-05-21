"use client"

import * as React from "react"
import {
    X, Check, FileText, Clock,
    Globe, Brain, Wand2, Sparkles, ScanSearch, Scale,
    BookOpen, PenLine, Loader2, Map as MapIcon, FolderSearch,
    ShieldCheck, Gavel, ClipboardCheck, CheckCircle, GitCompare, AlertTriangle,
    Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import {
    ChatCitationSource,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
} from "@/lib/citations"
import { SourceFavicon } from "@/components/chat/source-favicon"
import { getPhaseLabel, getPhaseCategory, ACTIVITY_PHASE_CONFIG, type PhaseCategory } from "@/lib/ai/activity-constants"

// Map icon names from config to actual Lucide components (small size for sidebar)
const SIDEBAR_ICON_MAP: Record<string, React.ReactNode> = {
    Loader2: <Loader2 className="h-3 w-3" />,
    Brain: <Brain className="h-3 w-3" />,
    Map: <MapIcon className="h-3 w-3" />,
    Globe: <Globe className="h-3 w-3" />,
    FolderSearch: <FolderSearch className="h-3 w-3" />,
    BookOpen: <BookOpen className="h-3 w-3" />,
    ScanSearch: <ScanSearch className="h-3 w-3" />,
    FileSearch: <ScanSearch className="h-3 w-3" />,
    GitCompare: <GitCompare className="h-3 w-3" />,
    Scale: <Scale className="h-3 w-3" />,
    ShieldCheck: <ShieldCheck className="h-3 w-3" />,
    Gavel: <Gavel className="h-3 w-3" />,
    ClipboardCheck: <ClipboardCheck className="h-3 w-3" />,
    Wand2: <Wand2 className="h-3 w-3" />,
    PenLine: <PenLine className="h-3 w-3" />,
    Sparkles: <Sparkles className="h-3 w-3" />,
    CheckCircle: <CheckCircle className="h-3 w-3" />,
    CheckCircle2: <Check className="h-3 w-3" />,
    AlertTriangle: <AlertTriangle className="h-3 w-3" />,
    Search: <Search className="h-3 w-3" />,
    FileText: <FileText className="h-3 w-3" />,
}

function getPhaseIconForSidebar(phase: string): React.ReactNode {
    const config = ACTIVITY_PHASE_CONFIG[phase]
    if (config) {
        return SIDEBAR_ICON_MAP[config.icon] || <Brain className="h-3 w-3" />
    }
    return <Brain className="h-3 w-3" />
}

interface ActivitySidebarProps {
    isOpen: boolean
    duration: number | null
    entries: { phase: string; detail: string; time: Date }[]
    completedPhases: string[]
    sources: ChatCitationSource[]
    isThinkingMode: boolean
    onClose: () => void
}

// Group entries by phase category for Harvey-style organized display
const CATEGORY_ORDER: PhaseCategory[] = [
    'initialization', 'analysis', 'research', 'extraction', 'validation', 'synthesis', 'drafting', 'completion', 'error'
]

const CATEGORY_LABELS: Record<PhaseCategory, string> = {
    initialization: 'Initialization',
    analysis: 'Analysis',
    research: 'Research',
    extraction: 'Extraction',
    validation: 'Validation',
    synthesis: 'Synthesis',
    drafting: 'Drafting',
    completion: 'Completion',
    error: 'Errors',
}

export function ActivitySidebar({ isOpen, duration, entries, completedPhases, sources, isThinkingMode, onClose }: ActivitySidebarProps) {
    const isMobile = useIsMobile()
    const durationLabel = duration ? `${duration}s` : '...'

    // Group entries by their phase category (must be above early return — hooks cannot be conditional)
    const groupedEntries = React.useMemo(() => {
        const groups: Record<string, { phase: string; detail: string; time: Date }[]> = {}
        for (const entry of entries) {
            const category = getPhaseCategory(entry.phase)
            if (!groups[category]) groups[category] = []
            groups[category].push(entry)
        }
        return groups
    }, [entries])

    // Format time elapsed from first entry
    const firstEntryTime = entries.length > 0 ? entries[0].time : null
    const formatElapsed = (time: Date) => {
        if (!firstEntryTime) return ''
        const elapsed = Math.round((time.getTime() - firstEntryTime.getTime()) / 1000)
        if (elapsed < 1) return '0s'
        return `${elapsed}s`
    }

    if (!isOpen && !isMobile) return null

    const content = (
        <div className={isMobile ? "flex flex-col h-full bg-background" : "w-[380px] h-full border-l bg-background flex flex-col shadow-sm animate-in slide-in-from-right duration-300 shrink-0"}>
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
                {/* Completed Steps Summary */}
                {completedPhases.length > 0 && (
                    <div className="px-5 py-3 border-b border-border/40">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">
                            Completed Steps
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {completedPhases.map((cp, i) => (
                                <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-foreground/5 border border-border/40 rounded-lg text-[11px] font-medium text-foreground/60">
                                    <div className="text-green-600/70">{getPhaseIconForSidebar(cp)}</div>
                                    <span>{getPhaseLabel(cp)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Activity Entries — grouped by category */}
                <div className="px-5 py-4">
                    {CATEGORY_ORDER.map(category => {
                        const categoryEntries = groupedEntries[category]
                        if (!categoryEntries || categoryEntries.length === 0) return null

                        return (
                            <div key={category} className="mb-5 last:mb-0">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
                                    {CATEGORY_LABELS[category]}
                                </h3>
                                <div className="space-y-3">
                                    {categoryEntries.map((entry, idx) => (
                                        <div key={idx} className="flex items-start gap-3 animate-in fade-in duration-300">
                                            <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary/70">
                                                {getPhaseIconForSidebar(entry.phase)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <p className="text-sm font-medium text-foreground/90 leading-tight">
                                                        {entry.detail}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground/50 shrink-0 flex items-center gap-0.5">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {formatElapsed(entry.time)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground/40 font-medium">
                                                    {getPhaseLabel(entry.phase)}
                                                </span>
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
                            </div>
                        )
                    })}

                    {/* Fallback: ungrouped entries if no categories matched */}
                    {Object.keys(groupedEntries).length === 0 && entries.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold mb-4">{isThinkingMode ? 'Thinking' : 'Searching'}</h3>
                            {entries.map((entry, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                                    <p className="text-sm font-medium text-foreground/90 leading-tight">
                                        {entry.detail}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

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

    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <SheetContent side="right" className="w-full sm:max-w-full p-0 [&>button]:hidden">
                    <SheetTitle className="sr-only">Activity</SheetTitle>
                    {content}
                </SheetContent>
            </Sheet>
        )
    }

    return content
}

function extractDomains(text: string): string[] {
    const urlRegex = /https?:\/\/([^\/\s]+)/g
    const matches = text.matchAll(urlRegex)
    return Array.from(new Set(Array.from(matches).map(m => m[1])))
}
