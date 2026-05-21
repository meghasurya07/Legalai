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
    BookOpen,
    PenLine,
    Loader2,
    Map,
    FolderSearch,
    ShieldCheck,
    Gavel,
    ClipboardCheck,
    CheckCircle,
    GitCompare,
    AlertTriangle,
} from "lucide-react"
import { SourceFavicon } from "@/components/chat/source-favicon"
import {
    type ActivityPhase,
    getPhaseLabel,
    ACTIVITY_PHASE_CONFIG,
} from "@/lib/ai/activity-constants"

// Re-export the type so existing consumers don't break
export type { ActivityPhase }

export interface AIActivityTimelineProps {
    phase: ActivityPhase
    entries: { phase: string; detail: string; time: Date }[]
    completedPhases: string[]
    domains: string[]
    sourceCount: number
    isExpanded: boolean
    onToggleExpand: () => void
    currentVerb?: string
}

// Map icon names from config to actual Lucide components
const ICON_MAP: Record<string, React.ReactNode> = {
    Loader2: <Loader2 className="h-3.5 w-3.5" />,
    Brain: <Brain className="h-3.5 w-3.5" />,
    Map: <Map className="h-3.5 w-3.5" />,
    Globe: <Globe className="h-3.5 w-3.5" />,
    FolderSearch: <FolderSearch className="h-3.5 w-3.5" />,
    BookOpen: <BookOpen className="h-3.5 w-3.5" />,
    ScanSearch: <ScanSearch className="h-3.5 w-3.5" />,
    FileSearch: <ScanSearch className="h-3.5 w-3.5" />,
    GitCompare: <GitCompare className="h-3.5 w-3.5" />,
    Scale: <Scale className="h-3.5 w-3.5" />,
    ShieldCheck: <ShieldCheck className="h-3.5 w-3.5" />,
    Gavel: <Gavel className="h-3.5 w-3.5" />,
    ClipboardCheck: <ClipboardCheck className="h-3.5 w-3.5" />,
    Wand2: <Wand2 className="h-3.5 w-3.5" />,
    PenLine: <PenLine className="h-3.5 w-3.5" />,
    Sparkles: <Sparkles className="h-3.5 w-3.5" />,
    CheckCircle: <CheckCircle className="h-3.5 w-3.5" />,
    CheckCircle2: <Check className="h-3.5 w-3.5" />,
    AlertTriangle: <AlertTriangle className="h-3.5 w-3.5" />,
    Search: <Search className="h-3.5 w-3.5" />,
    FileText: <FileText className="h-3.5 w-3.5" />,
}

function getPhaseIconComponent(phase: string): React.ReactNode {
    const config = ACTIVITY_PHASE_CONFIG[phase]
    if (config) {
        return ICON_MAP[config.icon] || <Brain className="h-3.5 w-3.5" />
    }
    return <Brain className="h-3.5 w-3.5" />
}

// Detect if this is a "writing" phase (drafting/writing/reviewing_output)
function isWritingPhase(phase: string): boolean {
    return ['writing', 'drafting', 'drafting_response', 'reviewing_output'].includes(phase)
}

export function AIActivityTimeline({
    phase,
    entries,
    completedPhases,
    domains,
    sourceCount,
    isExpanded,
    onToggleExpand,
    currentVerb,
}: AIActivityTimelineProps) {
    if (!phase) return null

    const isComplete = phase === 'complete'
    const isWriting = isWritingPhase(phase)
    const isError = phase === 'error'

    // Harvey-style "Finished in N steps" summary when complete
    if (isComplete) {
        const stepCount = completedPhases.length
        if (stepCount === 0) return null

        return (
            <div className="flex gap-3 justify-start max-w-[90%] my-2 animate-in fade-in duration-300">
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-foreground/5 border-foreground/10 text-foreground/60">
                    <Check className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {React.createElement('button', {
                        onClick: onToggleExpand,
                        className: "flex items-center gap-2 group text-left w-fit",
                        'aria-expanded': isExpanded
                    }, (
                        <>
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                Finished in {stepCount} {stepCount === 1 ? 'step' : 'steps'}
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
                            {/* All completed steps */}
                            <div className="space-y-2">
                                {completedPhases.map((cp, i) => (
                                    <div key={i} className="flex items-center gap-2.5 text-[12px] text-muted-foreground/60">
                                        <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/10">
                                            <Check className="h-3 w-3 text-green-600" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-primary/60">{getPhaseIconComponent(cp)}</span>
                                            <span className="font-medium text-foreground/50">{getPhaseLabel(cp)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Determine current "display title" from centralized config
    const currentTitle = isWriting ? "Generating answer" : getPhaseLabel(phase)

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
                        <div className="flex flex-col">
                            <span className={`text-sm font-semibold tracking-tight ${isError ? 'text-destructive' : 'text-foreground/90'}`}>
                                {currentTitle}
                                {!isWriting && !isError && <span className="activity-shimmer ml-1 group-hover:text-primary"></span>}
                            </span>
                            {/* Rotating verb sub-label — Claude Code-inspired */}
                            {currentVerb && !isWriting && !isError && (
                                <span className="text-[11px] text-muted-foreground/70 font-medium activity-verb-rotate">
                                    {currentVerb}
                                </span>
                            )}
                        </div>

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
                                <div key={i} className="flex items-center gap-2.5 text-[12px] text-muted-foreground/60 animate-in fade-in slide-in-from-left-1 duration-300">
                                    <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/10">
                                        <Check className="h-3 w-3 text-green-600" />
                                    </div>
                                    <span className="font-medium text-foreground/40">{getPhaseLabel(cp)}</span>
                                </div>
                            ))}

                            {/* Current (Active) Phase */}
                            {!isWriting && !isError && (
                                <div className="flex items-center gap-2.5 text-[12px] animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 animate-pulse text-primary">
                                        {getPhaseIconComponent(phase) || <div className="h-1 w-1 bg-current rounded-full" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground/80">{getPhaseLabel(phase)}</span>
                                        {currentVerb && (
                                            <span className="text-[10px] text-muted-foreground/60 font-medium activity-verb-rotate">
                                                {currentVerb}
                                            </span>
                                        )}
                                    </div>
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

