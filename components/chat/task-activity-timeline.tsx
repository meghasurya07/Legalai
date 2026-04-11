import React from 'react';
import { AlignLeft, Check } from 'lucide-react';
import { ActivityPhase } from '@/components/chat/activity-timeline';

// Let's broaden the phase type internally since it could also be 'complete' or 'error'
type TimelinePhase = ActivityPhase | 'complete' | 'error' | null;

interface TaskActivityTimelineProps {
    phase: TimelinePhase;
    entries: { phase: string; detail: string; time: Date }[];
    completedPhases: string[];
    onClose?: () => void;
}

// Fallback human-readable labels for known backend phases
const phaseLabels: Record<string, string> = {
    thinking: 'Analyzing query',
    research_planning: 'Planning research',
    source_collection: 'Collecting sources',
    reading_extraction: 'Reading & extracting',
    synthesis: 'Synthesizing findings',
    searching_web: 'Searching the web',
    reading_sources: 'Reading sources',
    drafting: 'Drafting response',
    complete: 'Complete',
    error: 'Error occurred'
};

export function TaskActivityTimeline({ phase, entries, completedPhases, onClose }: TaskActivityTimelineProps) {
    if (!phase || phase === 'complete') return null;

    // Dynamically derive steps from the actual events received.
    // This allows it to work seamlessly for Tabular Review, Deep Research, Web Search, etc.
    const uniquePhases = Array.from(new Set([...completedPhases, ...(phase && (phase as string) !== 'complete' && phase !== 'error' ? [phase] : [])]));

    // Always attach "drafting" at the end if we've started any phases, unless we're already error/complete
    if (uniquePhases.length > 0 && !uniquePhases.includes('drafting') && phase !== 'error') {
        uniquePhases.push('drafting');
    }

    const displaySteps = uniquePhases.map(p => {
        // Get the latest detail for this phase to use as a label, or fallback to a default
        const phaseEntries = entries.filter(e => e.phase === p);
        const latestDetail = phaseEntries.length > 0 ? phaseEntries[phaseEntries.length - 1].detail : null;
        return {
            key: p,
            label: latestDetail || phaseLabels[p] || p.replace(/_/g, ' ')
        };
    });

    const activeIndex = displaySteps.findIndex(s => s.key === phase);

    return (
        <div className="w-full max-w-[380px] bg-[#FAFAFA] border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 my-2">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6] bg-white">
                <div className="flex items-center gap-2 text-[#111827]">
                    <AlignLeft className="h-4 w-4" />
                    <span className="text-[14px] font-semibold tracking-tight">Task</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-[13px] font-medium text-[#4B5563] hover:text-[#111827] transition-colors"
                    >
                        Close
                    </button>
                )}
            </div>

            {/* Timeline Area */}
            <div className="px-5 py-4 space-y-4 relative">
                {/* Vertical connector line */}
                {displaySteps.length > 1 && (
                    <div className="absolute left-[29px] top-6 bottom-8 w-[2px] bg-[#F3F4F6]" />
                )}

                {displaySteps.map((step, idx) => {
                    const isCompleted = completedPhases.includes(step.key) || (activeIndex !== -1 && idx < activeIndex);
                    const isActive = phase === step.key;

                    return (
                        <div key={step.key} className="flex items-start gap-3 relative z-10 group">
                            <div className="flex items-center justify-center w-5 h-5 shrink-0 mt-[1px]">
                                {isCompleted ? (
                                    <div className="h-5 w-5 rounded-full bg-[#111827] flex items-center justify-center">
                                        <Check className="h-3.5 w-3.5 text-white stroke-[3.5]" />
                                    </div>
                                ) : isActive ? (
                                    <div className="h-2 w-2 rounded-full bg-[#9CA3AF]" />
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-[#E5E7EB]" />
                                )}
                            </div>

                            <div className="flex flex-col">
                                <span className={`text-[13px] leading-tight ${isCompleted
                                    ? 'text-[#111827]'
                                    : isActive
                                        ? 'text-[#374151]'
                                        : 'text-[#9CA3AF]'
                                    }`}>
                                    {step.label}
                                    {isActive && step.key === 'drafting' && (
                                        <span className="inline-flex ml-1">...</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
