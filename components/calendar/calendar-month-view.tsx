"use client"

import { useMemo } from "react"
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from "date-fns"
import type { CalendarItem } from "@/types"
import { CalendarDayCell } from "./calendar-day-cell"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface CalendarMonthViewProps {
    currentDate: Date
    getItemsForDay: (date: Date) => CalendarItem[]
    isToday: (date: Date) => boolean
    onDayClick: (date: Date) => void
    onItemClick: (item: CalendarItem) => void
}

export function CalendarMonthView({ currentDate, getItemsForDay, isToday, onDayClick, onItemClick }: CalendarMonthViewProps) {
    const days = useMemo(() => {
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        const calStart = startOfWeek(monthStart)
        const calEnd = endOfWeek(monthEnd)
        return eachDayOfInterval({ start: calStart, end: calEnd })
    }, [currentDate])

    return (
        <div className="flex-1 flex flex-col border border-border/50 rounded-xl overflow-hidden bg-card">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border/50">
                {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 flex-1">
                {days.map(day => (
                    <CalendarDayCell
                        key={day.toISOString()}
                        date={day}
                        items={getItemsForDay(day)}
                        isCurrentMonth={isSameMonth(day, currentDate)}
                        isToday={isToday(day)}
                        onDayClick={onDayClick}
                        onItemClick={onItemClick}
                    />
                ))}
            </div>
        </div>
    )
}
