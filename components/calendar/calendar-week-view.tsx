"use client"

import { useMemo } from "react"
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns"
import type { CalendarItem } from "@/types"
import { CalendarEventPill } from "./calendar-event-pill"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM – 7 PM

interface CalendarWeekViewProps {
    currentDate: Date
    getItemsForDay: (date: Date) => CalendarItem[]
    isToday: (date: Date) => boolean
    onDayClick: (date: Date) => void
    onItemClick: (item: CalendarItem) => void
}

export function CalendarWeekView({ currentDate, getItemsForDay, isToday, onDayClick, onItemClick }: CalendarWeekViewProps) {
    const weekDays = useMemo(() => {
        const start = startOfWeek(currentDate)
        const end = endOfWeek(currentDate)
        return eachDayOfInterval({ start, end })
    }, [currentDate])

    return (
        <div className="flex-1 flex flex-col border border-border/50 rounded-xl overflow-hidden bg-card">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50">
                <div className="py-2" /> {/* Time column spacer */}
                {weekDays.map(day => (
                    <div
                        key={day.toISOString()}
                        className={cn(
                            "text-center py-2 border-l border-border/50",
                            isToday(day) && "bg-foreground/5"
                        )}
                    >
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                            {format(day, "EEE")}
                        </div>
                        <div className={cn(
                            "text-lg font-semibold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto",
                            isToday(day) ? "bg-foreground text-background" : "text-foreground"
                        )}>
                            {format(day, "d")}
                        </div>
                    </div>
                ))}
            </div>

            {/* All-day events row */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[32px]">
                <div className="text-[10px] text-muted-foreground px-1 py-1 text-right pr-2">All day</div>
                {weekDays.map(day => {
                    const allDayItems = getItemsForDay(day).filter(i => i.allDay)
                    return (
                        <div key={day.toISOString()} className="border-l border-border/50 p-0.5 space-y-0.5">
                            {allDayItems.map(item => (
                                <CalendarEventPill key={item.id} item={item} compact onClick={onItemClick} />
                            ))}
                        </div>
                    )
                })}
            </div>

            {/* Hourly grid */}
            <div className="flex-1 overflow-y-auto">
                {HOURS.map(hour => (
                    <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[48px] border-b border-border/30">
                        <div className="text-[10px] text-muted-foreground text-right pr-2 pt-0.5">
                            {format(new Date(2000, 0, 1, hour), "h a")}
                        </div>
                        {weekDays.map(day => {
                            const timedItems = getItemsForDay(day).filter(i => {
                                if (i.allDay) return false
                                const h = new Date(i.startAt).getHours()
                                return h === hour
                            })
                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "border-l border-border/30 p-0.5 hover:bg-muted/20 cursor-pointer transition-colors",
                                        isToday(day) && "bg-foreground/[0.02]"
                                    )}
                                    onClick={() => onDayClick(day)}
                                >
                                    {timedItems.map(item => (
                                        <CalendarEventPill key={item.id} item={item} onClick={onItemClick} />
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}
