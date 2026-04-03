"use client"

import * as React from "react"
import {
    Globe,
    FileText,
    Wand2,
    Sparkles,
    Brain,
    ScanSearch,
    Scale,
    Search,
    ShieldAlert,
    Check,
    ChevronDown,
    ChevronRight,
} from "lucide-react"
import { SourceFavicon } from "@/components/chat/source-favicon"

export type ActivityPhase =
    | 'research_planning'
    | 'source_collection'
    | 'searching_web'
    | 'reading_sources'
    | 'reading_extraction'
    | 'comparing'
    | 'synthesis'
    | 'synthesizing'
    | 'thinking'
    | 'drafting'
    | 'writing'
    | 'complete'
    | 'error'
    | null

export interface AIActivityTimelineProps {
    phase: ActivityPhase
    entries: { phase: string; detail: string; time: Date }[]
    completedPhases: string[]
    domains: string[]
    sourceCount: number
    isExpanded: boolean
    onToggleExpand: () => void
}

export function AIActivityTimeline({
    phase,
    entries,
    completedPhases,
    domains,
    sourceCount,
    isExpanded,
    onToggleExpand
}: AIActivityTimelineProps) {
    if (!phase || phase === 'complete') return null

    const isWriting = phase === 'writing' || phase === 'drafting'
    const isError = phase === 'error'

    const phaseLabels: Record<string, string> = {
        research_planning: 'Research Planning',
        source_collection: 'Source Collection',
        searching_web: 'Searching Web',
        reading_sources: 'Reading Sources',
        reading_extraction: 'Information Extraction',
        comparing: 'Data Synthesis',
        synthesis: 'Synthesizing',
        synthesizing: 'Synthesizing',
        thinking: 'Analyzing Problem',
        drafting: 'Formulating Response',
        writing: 'Writing',
        error: 'System Error'
    }

    const phaseIcons: Record<string, React.ReactNode> = {
        research_planning: <Search className="h-3.5 w-3.5" />,
        source_collection: <Globe className="h-3.5 w-3.5" />,
        searching_web: <Globe className="h-3.5 w-3.5" />,
        reading_sources: <FileText className="h-3.5 w-3.5" />,
        reading_extraction: <ScanSearch className="h-3.5 w-3.5" />,
        comparing: <Scale className="h-3.5 w-3.5" />,
        synthesis: <Wand2 className="h-3.5 w-3.5" />,
        synthesizing: <Wand2 className="h-3.5 w-3.5" />,
        thinking: <Brain className="h-3.5 w-3.5" />,
        drafting: <Sparkles className="h-3.5 w-3.5" />,
        writing: <Sparkles className="h-3.5 w-3.5" />,
        error: <ShieldAlert className="h-3.5 w-3.5" />
    }

    // Determine current "display title"
    const currentTitle = isWriting ? "Generating answer" : (phaseLabels[phase] || "Processing")

    return (
        <div className="flex gap-3 justify-start max-w-[90%] my-2 animate-in fade-in slide-in-from-left-2 duration-300">
            {/* Avatar for Activity */}
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border transition-colors ${isError ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                isWriting ? 'bg-primary/10 border-primary/20 text-primary' :
                    'bg-muted/50 border-border text-muted-foreground'
                }`}>
                {isWriting ? <Sparkles className="h-4 w-4" /> : isError ? <ShieldAlert className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-2">
                {/* Header / Primary Status */}
                {React.createElement('button', {
                    onClick: onToggleExpand,
                    className: "flex items-center gap-2 group text-left w-fit",
                    'aria-expanded': isExpanded
                }, (
                    <>
                        <span className={`text-sm font-semibold tracking-tight ${isError ? 'text-destructive' : 'text-foreground/90'}`}>
                            {currentTitle}
                            {!isWriting && !isError && <span className="activity-shimmer ml-1 group-hover:text-primary"></span>}
                        </span>

                        {sourceCount > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                                {sourceCount} {sourceCount === 1 ? 'Source' : 'Sources'}
                            </span>
                        )}

                        <div className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </div>
                    </>
                ))}

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="flex flex-col gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 animate-in zoom-in-98 duration-200 origin-top">
                        {/* Domain Badges */}
                        {domains.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pb-1">
                                {domains.map((domain, i) => (
                                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-background border border-border/60 rounded-lg text-[11px] font-medium text-foreground/70 shadow-sm">
                                        <SourceFavicon url={`https://${domain}`} size={14} className="rounded-sm opacity-80" />
                                        <span>{domain}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Phase Steps */}
                        <div className="space-y-2">
                            {/* Completed Phases */}
                            {completedPhases.map((cp, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-[12px] text-muted-foreground/60">
                                    <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/10">
                                        <Check className="h-3 w-3 text-green-600" />
                                    </div>
                                    <span className="font-medium text-foreground/40">{phaseLabels[cp] || cp.replace(/_/g, ' ')}</span>
                                </div>
                            ))}

                            {/* Current (Active) Phase */}
                            {!isWriting && !isError && (
                                <div className="flex items-center gap-2.5 text-[12px]">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 animate-pulse text-primary">
                                        {phaseIcons[phase] || <div className="h-1 w-1 bg-current rounded-full" />}
                                    </div>
                                    <span className="font-semibold text-foreground/80">{phaseLabels[phase] || phase.replace(/_/g, ' ')}</span>
                                    <span className="activity-shimmer-dots text-primary"></span>
                                </div>
                            )}

                            {/* Detail entries for the current phase */}
                            {entries.filter(e => e.phase === phase).slice(-1).map((entry, i) => (
                                <div key={i} className="pl-7 text-[12px] text-muted-foreground leading-relaxed animate-in fade-in duration-500">
                                    {entry.detail}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
