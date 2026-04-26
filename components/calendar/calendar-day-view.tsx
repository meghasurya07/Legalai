"use client"

import { format } from "date-fns"
import type { CalendarItem } from "@/types"
import { CalendarEventPill } from "./calendar-event-pill"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7)

interface CalendarDayViewProps {
    currentDate: Date
    getItemsForDay: (date: Date) => CalendarItem[]
    isToday: (date: Date) => boolean
    onItemClick: (item: CalendarItem) => void
}

export function CalendarDayView({ currentDate, getItemsForDay, isToday, onItemClick }: CalendarDayViewProps) {
    const items = getItemsForDay(currentDate)
    const allDayItems = items.filter(i => i.allDay)

    return (
        <div className="flex-1 flex flex-col border border-border/50 rounded-xl overflow-hidden bg-card">
            {/* Day header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                <div className={cn(
                    "w-12 h-12 rounded-xl flex flex-col items-center justify-center",
                    isToday(currentDate)
                        ? "bg-foreground text-background"
                        : "bg-muted"
                )}>
                    <span className="text-[10px] font-semibold uppercase leading-none">
                        {format(currentDate, "EEE")}
                    </span>
                    <span className="text-lg font-bold leading-none mt-0.5">
                        {format(currentDate, "d")}
                    </span>
                </div>
                <div>
                    <h3 className="font-semibold text-foreground">{format(currentDate, "EEEE, MMMM d")}</h3>
                    <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* All-day */}
            {allDayItems.length > 0 && (
                <div className="px-4 py-2 border-b border-border/50 bg-muted/20">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">All Day</div>
                    <div className="space-y-1">
                        {allDayItems.map(item => (
                            <CalendarEventPill key={item.id} item={item} onClick={onItemClick} />
                        ))}
                    </div>
                </div>
            )}

            {/* Hourly grid */}
            <div className="flex-1 overflow-y-auto">
                {HOURS.map(hour => {
                    const hourItems = items.filter(i => {
                        if (i.allDay) return false
                        return new Date(i.startAt).getHours() === hour
                    })
                    return (
                        <div key={hour} className="flex min-h-[56px] border-b border-border/30">
                            <div className="w-16 text-[11px] text-muted-foreground text-right pr-3 pt-1 shrink-0">
                                {format(new Date(2000, 0, 1, hour), "h a")}
                            </div>
                            <div className="flex-1 border-l border-border/30 p-1 hover:bg-muted/10 transition-colors">
                                {hourItems.map(item => (
                                    <CalendarEventPill key={item.id} item={item} onClick={onItemClick} />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
