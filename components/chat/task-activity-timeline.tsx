import React from 'react';
import { AlignLeft, Check } from 'lucide-react';
import type { ActivityPhase } from '@/lib/ai/activity-constants';
import { getPhaseLabel } from '@/lib/ai/activity-constants';

interface TaskActivityTimelineProps {
    phase: ActivityPhase;
    entries: { phase: string; detail: string; time: Date }[];
    completedPhases: string[];
    currentVerb?: string;
    onClose?: () => void;
}

export function TaskActivityTimeline({ phase, entries, completedPhases, currentVerb, onClose }: TaskActivityTimelineProps) {
    if (!phase || phase === 'complete') return null;

    // Dynamically derive steps from the actual events received.
    // This allows it to work seamlessly for Tabular Review, Deep Research, Web Search, etc.
    const uniquePhases = Array.from(new Set([...completedPhases, ...(phase && (phase as string) !== 'complete' && phase !== 'error' ? [phase] : [])]));

    // Always attach "drafting_response" at the end if we've started any phases, unless we're already error/complete
    if (uniquePhases.length > 0 && !uniquePhases.includes('drafting_response') && !uniquePhases.includes('drafting') && phase !== 'error') {
        uniquePhases.push('drafting_response');
    }

    const displaySteps = uniquePhases.map(p => {
        // Get the latest detail for this phase to use as a label, or fallback to config
        const phaseEntries = entries.filter(e => e.phase === p);
        const latestDetail = phaseEntries.length > 0 ? phaseEntries[phaseEntries.length - 1].detail : null;
        return {
            key: p,
            label: latestDetail || getPhaseLabel(p)
        };
    });

    const activeIndex = displaySteps.findIndex(s => s.key === phase);

    return (
        <div className="w-full max-w-[380px] bg-card border border-border/60 rounded-[16px] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 my-2">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
                <div className="flex items-center gap-2 text-foreground">
                    <AlignLeft className="h-4 w-4" />
                    <span className="text-[14px] font-semibold tracking-tight">Task</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Close
                    </button>
                )}
            </div>

            {/* Timeline Area */}
            <div className="px-5 py-4 space-y-4 relative">
                {/* Vertical connector line */}
                {displaySteps.length > 1 && (
                    <div className="absolute left-[29px] top-6 bottom-8 w-[2px] bg-border/40" />
                )}

                {displaySteps.map((step, idx) => {
                    const isCompleted = completedPhases.includes(step.key) || (activeIndex !== -1 && idx < activeIndex);
                    const isActive = phase === step.key;

                    return (
                        <div key={step.key} className={`flex items-start gap-3 relative z-10 group ${isActive ? 'animate-in fade-in slide-in-from-left-1 duration-300' : ''}`}>
                            <div className="flex items-center justify-center w-5 h-5 shrink-0 mt-[1px]">
                                {isCompleted ? (
                                    <div className="h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
                                        <Check className="h-3.5 w-3.5 text-background stroke-[3.5]" />
                                    </div>
                                ) : isActive ? (
                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-border" />
                                )}
                            </div>

                            <div className="flex flex-col">
                                <span className={`text-[13px] leading-tight ${isCompleted
                                    ? 'text-foreground'
                                    : isActive
                                        ? 'text-foreground/80'
                                        : 'text-muted-foreground/50'
                                    }`}>
                                    {step.label}
                                    {isActive && step.key === 'drafting_response' && (
                                        <span className="inline-flex ml-1">...</span>
                                    )}
                                </span>
                                {/* Show rotating verb for active step */}
                                {isActive && currentVerb && (
                                    <span className="text-[11px] text-muted-foreground/60 font-medium activity-verb-rotate mt-0.5">
                                        {currentVerb}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
