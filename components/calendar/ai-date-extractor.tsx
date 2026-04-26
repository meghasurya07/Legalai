"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Check, Calendar, Sparkles, AlertCircle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { format, parseISO, isPast } from "date-fns"
import { toast } from "sonner"

interface ExtractedDate {
    title: string
    date: string
    time: string | null
    type: "event" | "deadline"
    deadlineType: string
    priority: string
    context: string | null
    confidence: number
    projectId: string | null
}

interface AIDateExtractorProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    documentName?: string
    documentText: string
    projectId?: string
    onAddDeadline: (data: Record<string, unknown>) => Promise<void>
    onAddEvent: (data: Record<string, unknown>) => Promise<void>
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
    high: { label: "High", color: "text-emerald-500" },
    medium: { label: "Medium", color: "text-amber-500" },
    low: { label: "Low", color: "text-red-400" },
}

function getConfidenceLevel(c: number): "high" | "medium" | "low" {
    if (c >= 0.8) return "high"
    if (c >= 0.5) return "medium"
    return "low"
}

const PRIORITY_DOTS: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
}

export function AIDateExtractor({
    open, onOpenChange, documentName, documentText, projectId,
    onAddDeadline, onAddEvent,
}: AIDateExtractorProps) {
    const [isExtracting, setIsExtracting] = useState(false)
    const [dates, setDates] = useState<ExtractedDate[]>([])
    const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
    const [isAdding, setIsAdding] = useState(false)
    const [addedCount, setAddedCount] = useState(0)
    const [hasExtracted, setHasExtracted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleExtract = async () => {
        setIsExtracting(true)
        setError(null)
        try {
            const res = await fetch("/api/calendar/extract-dates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: documentText, projectId }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Extraction failed")
            }
            const data = await res.json()
            setDates(data.dates || [])
            // Auto-select all future dates
            const futureIndexes = new Set<number>()
            ;(data.dates || []).forEach((d: ExtractedDate, i: number) => {
                if (!isPast(parseISO(d.date))) futureIndexes.add(i)
            })
            setSelectedIndexes(futureIndexes)
            setHasExtracted(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Extraction failed")
        } finally {
            setIsExtracting(false)
        }
    }

    const toggleItem = (idx: number) => {
        const next = new Set(selectedIndexes)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        setSelectedIndexes(next)
    }

    const handleAddSelected = async () => {
        if (selectedIndexes.size === 0) return
        setIsAdding(true)
        let added = 0

        try {
            for (const idx of selectedIndexes) {
                const d = dates[idx]
                const dueAt = d.time
                    ? new Date(`${d.date}T${d.time}:00`).toISOString()
                    : new Date(`${d.date}T17:00:00`).toISOString()

                if (d.type === "event") {
                    await onAddEvent({
                        title: d.title,
                        eventType: "hearing",
                        startAt: dueAt,
                        endAt: new Date(new Date(dueAt).getTime() + 3600000).toISOString(),
                        allDay: !d.time,
                        projectId: d.projectId,
                    })
                } else {
                    await onAddDeadline({
                        title: d.title,
                        deadlineType: d.deadlineType,
                        dueAt,
                        priority: d.priority,
                        projectId: d.projectId,
                        description: d.context ? `Extracted from document: "${d.context}"` : undefined,
                    })
                }
                added++
            }
            setAddedCount(added)
            toast.success(`Added ${added} item${added !== 1 ? "s" : ""} to your calendar`)
        } catch {
            toast.error(`Added ${added} items, but some failed`)
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        AI Date Extraction
                    </DialogTitle>
                </DialogHeader>

                {/* Document info */}
                {documentName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="truncate">{documentName}</span>
                        <span className="ml-auto opacity-60">{(documentText.length / 1000).toFixed(0)}k chars</span>
                    </div>
                )}

                {/* Pre-extraction state */}
                {!hasExtracted && !isExtracting && (
                    <div className="text-center py-8 space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Scan Document for Dates</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Wesley AI will analyze this document and extract all dates, deadlines, and time-sensitive events.
                            </p>
                        </div>
                        <Button onClick={handleExtract} className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Extract Dates
                        </Button>
                    </div>
                )}

                {/* Loading state */}
                {isExtracting && (
                    <div className="text-center py-12 space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
                        <p className="text-sm text-muted-foreground">Analyzing document for dates and deadlines...</p>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={handleExtract}>
                            Retry
                        </Button>
                    </div>
                )}

                {/* Results */}
                {hasExtracted && dates.length === 0 && !isExtracting && (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No dates or deadlines found in this document.</p>
                    </div>
                )}

                {hasExtracted && dates.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{dates.length} date{dates.length !== 1 ? "s" : ""} found</span>
                            <span>{selectedIndexes.size} selected</span>
                        </div>

                        <div className="space-y-1 max-h-[400px] overflow-y-auto">
                            {dates.map((d, idx) => {
                                const isSelected = selectedIndexes.has(idx)
                                const past = isPast(parseISO(d.date))
                                const conf = getConfidenceLevel(d.confidence)
                                const confInfo = CONFIDENCE_LABELS[conf]

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => toggleItem(idx)}
                                        className={cn(
                                            "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-all",
                                            isSelected
                                                ? "bg-indigo-50 dark:bg-indigo-900/15 border-indigo-200 dark:border-indigo-800/40"
                                                : "bg-transparent border-transparent hover:bg-muted/30",
                                            past && "opacity-50"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-4 w-4 mt-0.5 rounded border flex items-center justify-center shrink-0",
                                            isSelected
                                                ? "bg-indigo-500 border-indigo-500"
                                                : "border-muted-foreground/30"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-medium">{d.title}</span>
                                                <span className={cn("text-[10px]", confInfo.color)}>
                                                    {Math.round(d.confidence * 100)}%
                                                </span>
                                                {d.type === "event" && (
                                                    <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1 rounded">event</span>
                                                )}
                                                {past && (
                                                    <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded">past</span>
                                                )}
                                            </div>
                                            {d.context && (
                                                <p className="text-[10px] text-muted-foreground line-clamp-2 italic">
                                                    &ldquo;{d.context}&rdquo;
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOTS[String(d.priority)] || PRIORITY_DOTS.medium)} />
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                <span className="text-[11px] font-mono">
                                                    {format(parseISO(d.date), "MMM d, yyyy")}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {addedCount > 0 ? (
                            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 pt-2">
                                <Check className="h-4 w-4" />
                                <span>Added {addedCount} items to your calendar</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={handleAddSelected}
                                    disabled={isAdding || selectedIndexes.size === 0}
                                >
                                    {isAdding ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Calendar className="h-3 w-3" />
                                    )}
                                    Add {selectedIndexes.size} to Calendar
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
