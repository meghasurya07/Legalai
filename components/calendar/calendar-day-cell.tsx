"use client"

import type { CalendarItem } from "@/types"
import { cn } from "@/lib/utils"
import { CalendarEventPill } from "./calendar-event-pill"

interface CalendarDayCellProps {
    date: Date
    items: CalendarItem[]
    isCurrentMonth: boolean
    isToday: boolean
    onDayClick: (date: Date) => void
    onItemClick: (item: CalendarItem) => void
}

export function CalendarDayCell({ date, items, isCurrentMonth, isToday, onDayClick, onItemClick }: CalendarDayCellProps) {
    const dayNum = date.getDate()
    const maxVisible = 3
    const overflow = items.length - maxVisible

    return (
        <div
            onClick={() => onDayClick(date)}
            className={cn(
                "min-h-[100px] p-1 border-b border-r border-border/50 cursor-pointer transition-colors",
                "hover:bg-muted/30 dark:hover:bg-muted/20",
                !isCurrentMonth && "opacity-40 bg-muted/10"
            )}
        >
            <div className="flex items-center justify-between mb-0.5">
                <span
                    className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                        isToday && "bg-foreground text-background font-bold",
                        !isToday && isCurrentMonth && "text-foreground",
                        !isToday && !isCurrentMonth && "text-muted-foreground"
                    )}
                >
                    {dayNum}
                </span>
            </div>
            <div className="space-y-0.5">
                {items.slice(0, maxVisible).map(item => (
                    <CalendarEventPill key={item.id} item={item} compact onClick={onItemClick} />
                ))}
                {overflow > 0 && (
                    <span className="text-[10px] text-muted-foreground pl-1.5 font-medium">
                        +{overflow} more
                    </span>
                )}
            </div>
        </div>
    )
}
