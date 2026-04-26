"use client"

import { useState, useMemo, useEffect } from "react"
import { format } from "date-fns"
import { Sparkles, Check, Calendar, Scale, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DeadlineType, DeadlinePriority } from "@/types"
import { getChainsForType, computeChainDates } from "@/lib/calendar/deadline-chains"

interface DeadlineChainSuggestionProps {
    deadlineType: DeadlineType
    baseDate: Date
    projectId?: string | null
    caseNumber?: string | null
    courtName?: string | null
    judgeName?: string | null
    onCreateChain: (deadlines: Array<{
        title: string
        deadlineType: DeadlineType
        dueAt: string
        priority: DeadlinePriority
        projectId?: string | null
        caseNumber?: string | null
        courtName?: string | null
        judgeName?: string | null
        description?: string
    }>) => Promise<void>
}

const PRIORITY_COLORS: Record<string, string> = {
    critical: "text-red-500",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-green-500",
}

const PRIORITY_BG: Record<string, string> = {
    critical: "bg-red-500/10 border-red-500/20",
    high: "bg-orange-500/10 border-orange-500/20",
    medium: "bg-yellow-500/10 border-yellow-500/20",
    low: "bg-green-500/10 border-green-500/20",
}

export function DeadlineChainSuggestion({
    deadlineType,
    baseDate,
    projectId,
    caseNumber,
    courtName,
    judgeName,
    onCreateChain,
}: DeadlineChainSuggestionProps) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
    const [createdChain, setCreatedChain] = useState<string | null>(null)

    const chains = useMemo(() => getChainsForType(deadlineType), [deadlineType])

    // Auto-select all items when chains change
    useEffect(() => {
        if (chains.length > 0) {
            const allIndexes = new Set<number>()
            let idx = 0
            chains.forEach(chain => {
                chain.items.forEach(() => {
                    allIndexes.add(idx)
                    idx++
                })
            })
            setSelectedItems(allIndexes)
            setCreatedChain(null)
        }
    }, [chains])

    if (chains.length === 0) return null

    const toggleItem = (index: number) => {
        const next = new Set(selectedItems)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        setSelectedItems(next)
    }

    const handleCreateChain = async () => {
        if (selectedItems.size === 0) return
        setIsCreating(true)
        try {
            const deadlines: Array<{
                title: string
                deadlineType: DeadlineType
                dueAt: string
                priority: DeadlinePriority
                projectId?: string | null
                caseNumber?: string | null
                courtName?: string | null
                judgeName?: string | null
                description?: string
            }> = []

            let idx = 0
            chains.forEach(chain => {
                const computed = computeChainDates(chain, baseDate)
                computed.forEach(item => {
                    if (selectedItems.has(idx)) {
                        deadlines.push({
                            title: item.title,
                            deadlineType: item.deadlineType,
                            dueAt: item.computedDate.toISOString(),
                            priority: item.priority,
                            projectId,
                            caseNumber,
                            courtName,
                            judgeName,
                            description: `${item.description} (${chain.jurisdiction})`,
                        })
                    }
                    idx++
                })
            })

            await onCreateChain(deadlines)
            setCreatedChain(`${deadlines.length} related deadlines`)
        } finally {
            setIsCreating(false)
        }
    }

    let globalIdx = 0

    return (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        Smart Chain Detected
                    </span>
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400">
                        {chains.reduce((sum, c) => sum + c.items.length, 0)} related deadlines
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-indigo-400" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
                )}
            </button>

            {/* Body */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                    {createdChain ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                            <Check className="h-4 w-4" />
                            <span>Created {createdChain}</span>
                        </div>
                    ) : (
                        <>
                            {chains.map((chain) => {
                                const computed = computeChainDates(chain, baseDate)

                                return (
                                    <div key={chain.triggerId} className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                            <Scale className="h-3 w-3" />
                                            <span className="font-medium">{chain.label}</span>
                                            <span className="opacity-60">· {chain.jurisdiction}</span>
                                        </div>

                                        <div className="space-y-1">
                                            {computed.map((item) => {
                                                const thisIdx = globalIdx++
                                                const isSelected = selectedItems.has(thisIdx)
                                                const isPast = item.computedDate < new Date()

                                                return (
                                                    <button
                                                        key={thisIdx}
                                                        type="button"
                                                        onClick={() => toggleItem(thisIdx)}
                                                        className={cn(
                                                            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left transition-all text-xs",
                                                            isSelected
                                                                ? PRIORITY_BG[item.priority]
                                                                : "bg-transparent border-transparent opacity-50",
                                                            isPast && "opacity-40"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                                                            isSelected
                                                                ? "bg-indigo-500 border-indigo-500"
                                                                : "border-muted-foreground/30"
                                                        )}>
                                                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-medium truncate">{item.title}</span>
                                                                <span className={cn("text-[10px] font-medium uppercase", PRIORITY_COLORS[item.priority])}>
                                                                    {item.priority}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                                                {item.description}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                                            <Calendar className="h-3 w-3" />
                                                            <span className="text-[11px] font-mono">
                                                                {format(item.computedDate, "MMM d, yyyy")}
                                                            </span>
                                                            {item.offsetDays > 0 && (
                                                                <span className="text-[9px] opacity-60">
                                                                    +{item.offsetDays}d
                                                                </span>
                                                            )}
                                                            {item.offsetDays < 0 && (
                                                                <span className="text-[9px] opacity-60">
                                                                    {item.offsetDays}d
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}

                            <div className="flex items-center justify-between pt-1">
                                <p className="text-[10px] text-muted-foreground italic">
                                    ⚠️ Dates are approximate. Verify with local court rules.
                                </p>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={handleCreateChain}
                                    disabled={isCreating || selectedItems.size === 0}
                                >
                                    {isCreating ? (
                                        <span className="animate-pulse">Creating...</span>
                                    ) : (
                                        <>
                                            <Sparkles className="h-3 w-3" />
                                            Create {selectedItems.size} Deadline{selectedItems.size !== 1 ? "s" : ""}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
