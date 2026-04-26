"use client"

import { format, parseISO, isToday as checkIsToday, isTomorrow, differenceInDays, differenceInHours, isPast } from "date-fns"
import type { CalendarItem } from "@/types"
import { DeadlineStatusBadge } from "./deadline-status-badge"
import type { DeadlineStatus, DeadlinePriority } from "@/types"
import { MapPin, FolderOpen, Timer, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

interface CalendarAgendaViewProps {
    calendarItems: CalendarItem[]
    onItemClick: (item: CalendarItem) => void
}

function getTimeUntil(dateStr: string): { text: string; urgent: boolean } {
    const date = parseISO(dateStr)
    if (isPast(date)) {
        const hoursAgo = Math.abs(differenceInHours(date, new Date()))
        if (hoursAgo < 24) return { text: `${hoursAgo}h ago`, urgent: true }
        return { text: `${Math.abs(differenceInDays(date, new Date()))}d ago`, urgent: true }
    }
    const hoursLeft = differenceInHours(date, new Date())
    if (hoursLeft < 1) return { text: "< 1h left", urgent: true }
    if (hoursLeft < 24) return { text: `${hoursLeft}h left`, urgent: hoursLeft < 4 }
    const daysLeft = differenceInDays(date, new Date())
    return { text: `${daysLeft}d left`, urgent: daysLeft < 2 }
}

export function CalendarAgendaView({ calendarItems, onItemClick }: CalendarAgendaViewProps) {
    // Group items by date
    const grouped = calendarItems.reduce<Record<string, CalendarItem[]>>((acc, item) => {
        const key = item.date
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
    }, {})

    const sortedDates = Object.keys(grouped).sort()

    if (sortedDates.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <span className="text-2xl">📅</span>
                </div>
                <p className="font-medium text-foreground">No upcoming events</p>
                <p className="text-sm mt-1">Create an event or deadline to get started</p>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-1">
            {sortedDates.map(dateStr => {
                const date = parseISO(dateStr)
                const items = grouped[dateStr]
                const today = checkIsToday(date)
                const tomorrow = isTomorrow(date)

                return (
                    <div key={dateStr}>
                        {/* Date header */}
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-1 py-2 border-b border-border/30">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {today ? "Today" : tomorrow ? "Tomorrow" : format(date, "EEEE, MMM d")}
                                {(today || tomorrow) && (
                                    <span className="ml-2 font-normal normal-case tracking-normal">
                                        {format(date, "MMM d")}
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-1 py-1">
                            {items.map(item => {
                                const countdown = item.kind === "deadline" ? getTimeUntil(item.startAt) : null
                                const isOverdue = countdown?.urgent && isPast(parseISO(item.startAt))

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onItemClick(item)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left group",
                                            isOverdue && "bg-red-50/40 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30"
                                        )}
                                    >
                                        {/* Color dot */}
                                        {/* noinspection CssInlineStyle */}
                                        <div
                                            className={cn("w-2.5 h-2.5 rounded-full shrink-0", isOverdue && "animate-pulse")}
                                            style={{ backgroundColor: item.color }}
                                        />

                                        {/* Time */}
                                        <div className="w-20 shrink-0 text-xs text-muted-foreground">
                                            {item.allDay
                                                ? "All day"
                                                : format(parseISO(item.startAt), "h:mm a")
                                            }
                                        </div>

                                        {/* Title + meta */}
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-medium truncate", isOverdue ? "text-red-700 dark:text-red-300" : "text-foreground")}>{item.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {item.location && (
                                                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                                        <MapPin className="h-3 w-3" />
                                                        {item.location}
                                                    </span>
                                                )}
                                                {item.projectTitle && (
                                                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                                        <FolderOpen className="h-3 w-3" />
                                                        {item.projectTitle}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Smart countdown for deadlines */}
                                        {countdown && (
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                                countdown.urgent
                                                    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                                    : "bg-muted/50 text-muted-foreground"
                                            )}>
                                                {countdown.urgent ? <Flame className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
                                                {countdown.text}
                                            </span>
                                        )}

                                        {/* Status badge for deadlines */}
                                        {item.kind === "deadline" && item.status && (
                                            <DeadlineStatusBadge status={item.status as DeadlineStatus} priority={item.priority as DeadlinePriority} />
                                        )}

                                        {/* Event type badge */}
                                        {/* noinspection CssInlineStyle */}
                                        <span
                                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: `${item.color}15`,
                                                color: item.color,
                                            }}
                                        >
                                            {item.type.replace(/_/g, " ")}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
