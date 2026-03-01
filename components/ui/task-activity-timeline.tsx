import React from 'react';
import { ListChecks, Check } from 'lucide-react';
import { ActivityPhase } from '@/components/chat-interface';

interface TaskActivityTimelineProps {
    phase: ActivityPhase;
    entries: { phase: string; detail: string; time: Date }[];
    completedPhases: string[];
    onClose?: () => void;
}

export function TaskActivityTimeline({ phase, entries, completedPhases, onClose }: TaskActivityTimelineProps) {
    if (!phase || phase === 'complete') return null;

    // Define the steps we want to display as part of the "Task" card
    const displaySteps = [
        { key: 'thinking', label: 'Analyzed query' },
        { key: 'reading_extraction', label: 'Tabular review inspected' },
        { key: 'synthesis', label: 'Analyzed columns by sorting table' },
        { key: 'drafting', label: 'Generating response...' }
    ];

    // Find current index to determine progress
    const activeIndex = displaySteps.findIndex(s => s.key === phase);

    return (
        <div className="w-full max-w-[400px] bg-white border border-[#E5E7EB] rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#F3F4F6] bg-gradient-to-r from-white to-[#FAFAFA]">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                        <ListChecks className="h-4.5 w-4.5 text-[#374151]" />
                    </div>
                    <span className="text-[14px] font-bold text-[#111827] tracking-tight">Task</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-[12px] font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
                    >
                        Close
                    </button>
                )}
            </div>

            {/* Timeline Area */}
            <div className="px-8 py-8 space-y-7 relative bg-gradient-to-b from-white to-[#FCFCFD]">
                {/* Vertical connector line */}
                <div className="absolute left-[40px] top-12 bottom-16 w-[2px] bg-[#F3F4F6]" />

                {displaySteps.map((step, idx) => {
                    const isCompleted = completedPhases.includes(step.key) || (activeIndex !== -1 && idx < activeIndex);
                    const isActive = phase === step.key;

                    // Get dynamic detail if available for synthesis
                    let displayLabel = step.label;
                    if (isActive && step.key === 'synthesis') {
                        const entry = entries.find(e => e.phase === 'synthesis');
                        if (entry?.detail) displayLabel = entry.detail;
                    }

                    return (
                        <div key={step.key} className="flex items-start gap-4.5 relative z-10 transition-all duration-500 group">
                            <div className="flex items-center justify-center w-[18px] h-[24px] shrink-0">
                                {isCompleted ? (
                                    <div className="h-6 w-6 rounded-full bg-[#111827] flex items-center justify-center animate-in zoom-in duration-300 ring-4 ring-white">
                                        <Check className="h-3.5 w-3.5 text-white stroke-[3.5]" />
                                    </div>
                                ) : isActive ? (
                                    <div className="relative h-6 w-6 flex items-center justify-center">
                                        <div className="absolute h-full w-full rounded-full bg-primary/10 animate-ping duration-[2000ms]" />
                                        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                    </div>
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-[#E5E7EB] group-hover:bg-[#D1D5DB] transition-colors" />
                                )}
                            </div>

                            <div className="flex flex-col pt-0.5">
                                <span className={`text-[13px] leading-tight transition-all duration-500 ${isCompleted
                                    ? 'text-[#4B5563] font-medium'
                                    : isActive
                                        ? 'text-[#111827] font-bold scale-[1.02] origin-left'
                                        : 'text-[#9CA3AF]'
                                    }`}>
                                    {displayLabel}
                                    {isActive && step.key === 'drafting' && (
                                        <span className="inline-flex ml-1">
                                            <span className="animate-bounce delay-0 text-current">.</span>
                                            <span className="animate-bounce delay-150 text-current">.</span>
                                            <span className="animate-bounce delay-300 text-current">.</span>
                                        </span>
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
