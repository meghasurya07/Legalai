"use client"

import type { CalendarItem } from "@/types"
import { cn } from "@/lib/utils"

interface CalendarEventPillProps {
    item: CalendarItem
    compact?: boolean
    onClick?: (item: CalendarItem) => void
}

export function CalendarEventPill({ item, compact = false, onClick }: CalendarEventPillProps) {
    const isDeadline = item.kind === "deadline"
    const isMissed = item.status === "missed"
    const isCompleted = item.status === "completed"

    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick?.(item) }}
            className={cn(
                "w-full text-left rounded-md px-1.5 py-0.5 text-[11px] font-medium truncate transition-all",
                "hover:opacity-80 hover:shadow-sm cursor-pointer",
                isCompleted && "line-through opacity-60",
                isMissed && "opacity-90",
                compact ? "leading-tight" : "leading-normal"
            )}
            style={{
                backgroundColor: `${item.color}18`,
                color: item.color,
                borderLeft: `2px solid ${item.color}`,
            }}
            title={`${item.title}${item.projectTitle ? ` • ${item.projectTitle}` : ""}`}
        >
            {isDeadline && <span className="mr-0.5">⏰</span>}
            {compact ? item.title : (
                <>
                    {!item.allDay && (
                        <span className="opacity-70 mr-1">
                            {new Date(item.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                    )}
                    {item.title}
                </>
            )}
        </button>
    )
}
