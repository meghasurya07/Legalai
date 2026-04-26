"use client"

import { format } from "date-fns"
import { ChevronLeft, ChevronRight, Plus, CalendarClock, Users, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CalendarView } from "@/types"
import type { CalendarScope } from "@/hooks/use-calendar"
import { cn } from "@/lib/utils"

interface CalendarHeaderProps {
    view: CalendarView
    currentDate: Date
    dateRange: { start: Date; end: Date }
    scope: CalendarScope
    hasOrg: boolean
    onViewChange: (view: CalendarView) => void
    onScopeChange: (scope: CalendarScope) => void
    onToday: () => void
    onPrev: () => void
    onNext: () => void
    onNewEvent: () => void
    onNewDeadline: () => void
}

const VIEWS: { value: CalendarView; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
    { value: "agenda", label: "Agenda" },
]

export function CalendarHeader({
    view, currentDate, dateRange, scope, hasOrg,
    onViewChange, onScopeChange, onToday, onPrev, onNext, onNewEvent, onNewDeadline,
}: CalendarHeaderProps) {
    const getDateLabel = () => {
        switch (view) {
            case "month":
                return format(currentDate, "MMMM yyyy")
            case "week":
                return `${format(dateRange.start, "MMM d")} – ${format(dateRange.end, "MMM d, yyyy")}`
            case "day":
                return format(currentDate, "EEEE, MMMM d, yyyy")
            case "agenda":
                return `Next 30 days`
        }
    }

    return (
        <div className="flex items-center justify-between gap-4 pb-4">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onToday}
                    className="rounded-lg text-xs h-8"
                >
                    Today
                </Button>
                <div className="flex items-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onPrev}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onNext}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <h2 className="text-lg font-semibold text-foreground min-w-[200px]">
                    {getDateLabel()}
                </h2>
            </div>

            {/* Right: Scope + View Toggle + Actions */}
            <div className="flex items-center gap-2">
                {/* Scope toggle (only if user has an org) */}
                {hasOrg && (
                    <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                        <button
                            onClick={() => onScopeChange("personal")}
                            className={cn(
                                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                scope === "personal"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <User className="h-3 w-3" />
                            My
                        </button>
                        <button
                            onClick={() => onScopeChange("firm")}
                            className={cn(
                                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                scope === "firm"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Users className="h-3 w-3" />
                            Firm
                        </button>
                    </div>
                )}

                {/* View tabs */}
                <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                    {VIEWS.map(v => (
                        <button
                            key={v.value}
                            onClick={() => onViewChange(v.value)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                view === v.value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                {/* Action buttons */}
                <Button variant="outline" size="sm" className="rounded-lg h-8 gap-1.5 text-xs" onClick={onNewDeadline}>
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Deadline</span>
                </Button>
                <Button size="sm" className="rounded-lg h-8 gap-1.5 text-xs" onClick={onNewEvent}>
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Event</span>
                </Button>
            </div>
        </div>
    )
}
