"use client"

import { useState } from "react"
import { Calendar, Check, Sparkles, X, Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"

export interface CalendarActionItem {
    title: string
    dueAt: string
    type: "deadline" | "event"
    deadlineType?: string
    priority?: string
    description?: string
}

interface CalendarActionCardProps {
    items: CalendarActionItem[]
    onDismiss: () => void
    messageId?: string
    conversationId?: string
    rawContent?: string
}

const PRIORITY_DOTS: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
}

export function CalendarActionCard({ items, onDismiss, messageId, conversationId, rawContent }: CalendarActionCardProps) {
    const [isAdding, setIsAdding] = useState(false)
    const [added, setAdded] = useState(false)

    const handleAdd = async () => {
        setIsAdding(true)
        try {
            let addedCount = 0
            for (const item of items) {
                if (item.type === "event") {
                    const res = await fetch("/api/calendar/events", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: item.title,
                            eventType: "hearing",
                            startAt: item.dueAt,
                            endAt: new Date(new Date(item.dueAt).getTime() + 3600000).toISOString(),
                            allDay: false,
                            description: item.description,
                        }),
                    })
                    if (res.ok) addedCount++
                } else {
                    const res = await fetch("/api/calendar/deadlines", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: item.title,
                            deadlineType: item.deadlineType || "custom",
                            dueAt: item.dueAt,
                            priority: item.priority || "medium",
                            description: item.description,
                        }),
                    })
                    if (res.ok) addedCount++
                }
            }
            setAdded(true)
            toast.success(`Added ${addedCount} item${addedCount !== 1 ? "s" : ""} to your calendar`)

            // Replace the <!--CALENDAR_ACTION:--> block with <!--CALENDAR_ADDED--> marker
            // so the UI shows a green "Added" badge on reload instead of the action card
            if (messageId && conversationId && rawContent) {
                const updatedContent = rawContent.replace(/<!--CALENDAR_ACTION:[\s\S]*?-->/g, "<!--CALENDAR_ADDED-->").trim()
                fetch(`/api/chat/conversations/${conversationId}/messages`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId, content: updatedContent }),
                }).catch(() => { /* silent — non-critical */ })
            }
        } catch {
            toast.error("Failed to add to calendar")
        } finally {
            setIsAdding(false)
        }
    }

    if (added) {
        return (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 rounded-lg px-3 py-2 mt-2">
                <Check className="h-3.5 w-3.5" />
                <span>Added to your calendar</span>
            </div>
        )
    }

    return (
        <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 dark:from-indigo-900/10 dark:to-violet-900/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100 dark:border-indigo-800/30">
                <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        Wesley suggests adding to calendar
                    </span>
                </div>
                <button
                    onClick={onDismiss}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Dismiss"
                    aria-label="Dismiss"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Items */}
            <div className="px-3 py-2 space-y-1.5">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            PRIORITY_DOTS[item.priority || "medium"]
                        )} />
                        <span className="font-medium flex-1 truncate">{item.title}</span>
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            <span className="font-mono text-[11px]">
                                {format(new Date(item.dueAt), "MMM d, yyyy")}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-indigo-100 dark:border-indigo-800/30">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={onDismiss}
                >
                    Dismiss
                </Button>
                <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleAdd}
                    disabled={isAdding}
                >
                    {isAdding ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <Calendar className="h-3 w-3" />
                    )}
                    Add to Calendar
                </Button>
            </div>
        </div>
    )
}

/**
 * Parse a chat message for <!--CALENDAR_ACTION:{...}--> or <!--CALENDAR_ADDED--> blocks.
 * Returns the cleaned message, any calendar action items found, and whether items were already added.
 */
export function parseCalendarAction(message: string): {
    cleanMessage: string
    calendarItems: CalendarActionItem[] | null
    alreadyAdded: boolean
} {
    // Check if items were already added (marker left after successful add)
    const addedMarker = /<!--CALENDAR_ADDED-->/
    if (addedMarker.test(message)) {
        let cleanMessage = message.replace(addedMarker, "").trim()
        // Clean up trailing references to the now-removed card
        cleanMessage = cleanMessage
            .replace(/\.?\s*You can add it to your calendar below\.?/gi, ".")
            .replace(/\.?\s*You can add (?:them|it|these) to your calendar below\.?/gi, ".")
            .replace(/\.\./g, ".")
            .trim()
        return { cleanMessage, calendarItems: null, alreadyAdded: true }
    }

    const regex = /<!--CALENDAR_ACTION:([\s\S]*?)-->/
    const match = message.match(regex)

    if (!match) {
        return { cleanMessage: message, calendarItems: null, alreadyAdded: false }
    }

    const cleanMessage = message.replace(regex, "").trim()

    try {
        const parsed = JSON.parse(match[1])
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            return {
                cleanMessage,
                calendarItems: parsed.items.filter(
                    (item: Record<string, unknown>) => item.title && item.dueAt
                ),
                alreadyAdded: false,
            }
        }
    } catch {
        // Failed to parse — ignore
    }

    return { cleanMessage, calendarItems: null, alreadyAdded: false }
}
