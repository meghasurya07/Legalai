"use client"

import { useState, useCallback, useEffect } from "react"
import { useCalendar } from "@/hooks/use-calendar"
import type { CalendarScope } from "@/hooks/use-calendar"
import { useOrg } from "@/context/org-context"
import { CalendarHeader } from "./calendar-header"
import { CalendarMonthView } from "./calendar-month-view"
import { CalendarWeekView } from "./calendar-week-view"
import { CalendarDayView } from "./calendar-day-view"
import { CalendarAgendaView } from "./calendar-agenda-view"
import { EventModal } from "./event-modal"
import { DeadlineModal } from "./deadline-modal"
import { EventDetailPopover } from "./event-detail-popover"
import { DeadlineStatusBadge } from "./deadline-status-badge"
import { Loader2, CalendarClock, AlertTriangle, CheckCircle2, Clock, Timer, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { format, parseISO, differenceInDays, differenceInHours, differenceInMinutes, isPast } from "date-fns"
import type { CalendarItem, CalendarEvent, Deadline, DeadlineStatus, DeadlinePriority } from "@/types"
import { cn } from "@/lib/utils"

interface CalendarPageProps {
    tab: "schedule" | "deadlines"
}

// ─── Smart Countdown ────────────────────────────
// Returns human-readable time remaining with urgency level
function getSmartCountdown(dueAt: string, status: string): {
    text: string
    urgency: "overdue" | "critical" | "soon" | "upcoming" | "safe" | "done"
    color: string
} {
    if (status === "completed") return { text: "Completed", urgency: "done", color: "text-emerald-600 dark:text-emerald-400" }
    if (status === "missed") return { text: "Missed", urgency: "overdue", color: "text-red-600 dark:text-red-400" }

    const now = new Date()
    const due = parseISO(dueAt)

    if (isPast(due)) {
        const hoursAgo = Math.abs(differenceInHours(due, now))
        if (hoursAgo < 1) return { text: `${Math.abs(differenceInMinutes(due, now))}m overdue`, urgency: "overdue", color: "text-red-600 dark:text-red-400" }
        if (hoursAgo < 24) return { text: `${hoursAgo}h overdue`, urgency: "overdue", color: "text-red-600 dark:text-red-400" }
        return { text: `${Math.abs(differenceInDays(due, now))}d overdue`, urgency: "overdue", color: "text-red-600 dark:text-red-400" }
    }

    const daysLeft = differenceInDays(due, now)
    const hoursLeft = differenceInHours(due, now)
    const minutesLeft = differenceInMinutes(due, now)

    if (minutesLeft < 60) return { text: `${minutesLeft}m left`, urgency: "critical", color: "text-red-600 dark:text-red-400" }
    if (hoursLeft < 4) return { text: `${hoursLeft}h left`, urgency: "critical", color: "text-red-600 dark:text-red-400" }
    if (hoursLeft < 24) return { text: `${hoursLeft}h left`, urgency: "soon", color: "text-amber-600 dark:text-amber-400" }
    if (daysLeft < 3) return { text: `${daysLeft}d left`, urgency: "soon", color: "text-amber-600 dark:text-amber-400" }
    if (daysLeft < 7) return { text: `${daysLeft}d left`, urgency: "upcoming", color: "text-blue-600 dark:text-blue-400" }
    return { text: `${daysLeft}d left`, urgency: "safe", color: "text-muted-foreground" }
}

// ─── Urgency Badge ──────────────────────────────
function UrgencyBadge({ countdown }: { countdown: ReturnType<typeof getSmartCountdown> }) {
    const configs = {
        overdue: { icon: Flame, bg: "bg-red-100 dark:bg-red-900/40", animate: "animate-pulse" },
        critical: { icon: Timer, bg: "bg-red-50 dark:bg-red-900/30", animate: "" },
        soon: { icon: Clock, bg: "bg-amber-50 dark:bg-amber-900/30", animate: "" },
        upcoming: { icon: Clock, bg: "bg-blue-50 dark:bg-blue-900/30", animate: "" },
        safe: { icon: Clock, bg: "bg-muted/30", animate: "" },
        done: { icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-900/30", animate: "" },
    }
    const config = configs[countdown.urgency]
    const Icon = config.icon

    return (
        <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
            config.bg, countdown.color, config.animate
        )}>
            <Icon className="h-3 w-3" />
            {countdown.text}
        </span>
    )
}

export function CalendarPage({ tab }: CalendarPageProps) {
    const cal = useCalendar()
    const { org } = useOrg()

    // Sync org ID to the calendar hook
    useEffect(() => {
        if (org?.id) cal.setOrgId(org.id)
    }, [org?.id, cal])

    // Scope change handler
    const handleScopeChange = useCallback((newScope: CalendarScope) => {
        cal.setScope(newScope)
    }, [cal])

    // Modal state
    const [eventModalOpen, setEventModalOpen] = useState(false)
    const [deadlineModalOpen, setDeadlineModalOpen] = useState(false)
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
    const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null)
    const [defaultDate, setDefaultDate] = useState<Date | undefined>()

    // Detail popover
    const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
    const [popoverOpen, setPopoverOpen] = useState(false)

    // Deadlines filter
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [priorityFilter, setPriorityFilter] = useState<string>("all")

    // Handler: Click a day cell (opens new event modal)
    const handleDayClick = useCallback((date: Date) => {
        setDefaultDate(date)
        setEditingEvent(null)
        setEventModalOpen(true)
    }, [])

    // Handler: Click an event pill
    const handleItemClick = useCallback((item: CalendarItem) => {
        setSelectedItem(item)
        setPopoverOpen(true)
    }, [])

    // Handler: Edit from popover
    const handleEdit = useCallback((item: CalendarItem) => {
        if (item.kind === "event") {
            const event = cal.events.find(e => e.id === item.id)
            if (event) { setEditingEvent(event); setEventModalOpen(true) }
        } else {
            const deadline = cal.deadlines.find(d => d.id === item.id)
            if (deadline) { setEditingDeadline(deadline); setDeadlineModalOpen(true) }
        }
    }, [cal.events, cal.deadlines])

    // Handler: Delete from popover
    const handlePopoverDelete = useCallback(async (item: CalendarItem) => {
        try {
            if (item.kind === "event") await cal.deleteEvent(item.id)
            else await cal.deleteDeadline(item.id)
            toast.success("Deleted successfully")
        } catch {
            toast.error("Failed to delete")
        }
    }, [cal])

    // Save handlers
    const handleSaveEvent = async (data: Partial<CalendarEvent>) => {
        try {
            // Inject orgId for firm-wide visibility
            const eventData = { ...data, orgId: org?.id || undefined }
            if (data.id) {
                await cal.updateEvent(data.id, eventData)
                toast.success("Event updated")
                return
            } else {
                const result = await cal.createEvent(eventData)
                // If conflict detected, return it for modal to display
                if (result && "conflict" in result && result.conflict) {
                    return result
                }
                toast.success("Event created")
                return
            }
        } catch {
            toast.error("Failed to save event")
            throw new Error()
        }
    }

    const handleForceCreateEvent = async (data: Partial<CalendarEvent>) => {
        try {
            const eventData = { ...data, orgId: org?.id || undefined }
            await cal.forceCreateEvent(eventData)
            toast.success("Event created (conflict overridden)")
        } catch {
            toast.error("Failed to create event")
        }
    }

    const handleSaveDeadline = async (data: Partial<Deadline>) => {
        try {
            const deadlineData = { ...data, orgId: org?.id || undefined }
            if (data.id) {
                await cal.updateDeadline(data.id, deadlineData)
                toast.success("Deadline updated")
            } else {
                await cal.createDeadline(deadlineData)
                toast.success("Deadline created")
            }
        } catch {
            toast.error("Failed to save deadline")
            throw new Error()
        }
    }

    const handleDeleteEvent = async (id: string) => {
        try {
            await cal.deleteEvent(id)
            toast.success("Event deleted")
        } catch {
            toast.error("Failed to delete event")
        }
    }

    const handleDeleteDeadline = async (id: string) => {
        try {
            await cal.deleteDeadline(id)
            toast.success("Deadline deleted")
        } catch {
            toast.error("Failed to delete deadline")
        }
    }

    // Batch create deadline chain
    const handleCreateChain = async (deadlines: unknown[]) => {
        try {
            const result = await cal.createDeadlineChain(deadlines as Array<Record<string, unknown>>)
            toast.success(`Created ${result.created} related deadlines`)
        } catch {
            toast.error("Failed to create deadline chain")
        }
    }

    // Quick status change for deadlines
    const handleStatusChange = async (deadline: Deadline, newStatus: DeadlineStatus) => {
        try {
            await cal.updateDeadline(deadline.id, { status: newStatus } as Partial<Deadline>)
            toast.success(`Marked as ${newStatus.replace("_", " ")}`)
        } catch {
            toast.error("Failed to update status")
        }
    }

    // Filtered deadlines
    const filteredDeadlines = cal.deadlines.filter(d => {
        if (statusFilter !== "all" && d.status !== statusFilter) return false
        if (priorityFilter !== "all" && d.priority !== priorityFilter) return false
        return true
    })

    // ---- SCHEDULE TAB ----
    if (tab === "schedule") {
        return (
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <CalendarHeader
                    view={cal.view}
                    currentDate={cal.currentDate}
                    dateRange={cal.dateRange}
                    scope={cal.scope}
                    hasOrg={!!org}
                    onViewChange={cal.setView}
                    onScopeChange={handleScopeChange}
                    onToday={cal.goToday}
                    onPrev={cal.goPrev}
                    onNext={cal.goNext}
                    onNewEvent={() => { setEditingEvent(null); setDefaultDate(undefined); setEventModalOpen(true) }}
                    onNewDeadline={() => { setEditingDeadline(null); setDefaultDate(undefined); setDeadlineModalOpen(true) }}
                />

                {cal.isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {cal.view === "month" && (
                            <CalendarMonthView
                                currentDate={cal.currentDate}
                                getItemsForDay={cal.getItemsForDay}
                                isToday={cal.isToday}
                                onDayClick={handleDayClick}
                                onItemClick={handleItemClick}
                            />
                        )}
                        {cal.view === "week" && (
                            <CalendarWeekView
                                currentDate={cal.currentDate}
                                getItemsForDay={cal.getItemsForDay}
                                isToday={cal.isToday}
                                onDayClick={handleDayClick}
                                onItemClick={handleItemClick}
                            />
                        )}
                        {cal.view === "day" && (
                            <CalendarDayView
                                currentDate={cal.currentDate}
                                getItemsForDay={cal.getItemsForDay}
                                isToday={cal.isToday}
                                onItemClick={handleItemClick}
                            />
                        )}
                        {cal.view === "agenda" && (
                            <CalendarAgendaView
                                calendarItems={cal.calendarItems}
                                onItemClick={handleItemClick}
                            />
                        )}
                    </>
                )}

                {/* Detail popover */}
                <EventDetailPopover
                    item={selectedItem}
                    open={popoverOpen}
                    onOpenChange={setPopoverOpen}
                    onEdit={handleEdit}
                    onDelete={handlePopoverDelete}
                />

                <EventModal
                    open={eventModalOpen}
                    onOpenChange={setEventModalOpen}
                    event={editingEvent}
                    defaultDate={defaultDate}
                    onSave={handleSaveEvent}
                    onForceSave={handleForceCreateEvent}
                    onDelete={handleDeleteEvent}
                />
                <DeadlineModal
                    open={deadlineModalOpen}
                    onOpenChange={setDeadlineModalOpen}
                    deadline={editingDeadline}
                    defaultDate={defaultDate}
                    onSave={handleSaveDeadline}
                    onDelete={handleDeleteDeadline}
                    onFetchAudit={cal.fetchAuditTrail}
                    onCreateChain={handleCreateChain}
                />
            </div>
        )
    }

    // ---- DEADLINES TAB ----
    return (
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Deadlines</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track and manage critical legal deadlines with smart countdown intelligence</p>
                </div>
                <Button size="sm" className="rounded-lg gap-1.5" onClick={() => { setEditingDeadline(null); setDefaultDate(undefined); setDeadlineModalOpen(true) }}>
                    <CalendarClock className="h-3.5 w-3.5" />
                    New Deadline
                </Button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Upcoming", value: cal.stats.upcoming, icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
                    { label: "Overdue", value: cal.stats.overdue, icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30", pulse: cal.stats.overdue > 0 },
                    { label: "Due This Week", value: cal.stats.dueThisWeek, icon: CalendarClock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
                    { label: "Completed", value: cal.stats.completedThisMonth, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
                ].map(stat => (
                    <div key={stat.label} className={cn(
                        "rounded-xl border border-border/50 bg-card p-4 transition-all",
                        "pulse" in stat && stat.pulse && "border-red-300 dark:border-red-800 shadow-sm shadow-red-100 dark:shadow-red-900/20"
                    )}>
                        <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.bg)}>
                                <stat.icon className={cn("h-5 w-5", stat.color)} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{cal.isStatsLoading ? "–" : stat.value}</p>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="missed">Missed</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="critical">🔴 Critical</SelectItem>
                        <SelectItem value="high">🟠 High</SelectItem>
                        <SelectItem value="medium">🟡 Medium</SelectItem>
                        <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">
                    {filteredDeadlines.length} deadline{filteredDeadlines.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-border/50 bg-card">
                {cal.isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredDeadlines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <span className="text-2xl">⏰</span>
                        </div>
                        <p className="font-medium text-foreground">No deadlines found</p>
                        <p className="text-sm mt-1">Create your first deadline to start tracking</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/50">
                                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Deadline</th>
                                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
                                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Due Date</th>
                                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Time Left</th>
                                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Priority</th>
                                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                                <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDeadlines.map(d => {
                                const countdown = getSmartCountdown(d.dueAt, d.status)
                                const isOverdue = countdown.urgency === "overdue"
                                const isCritical = countdown.urgency === "critical"
                                return (
                                    <tr
                                        key={d.id}
                                        className={cn(
                                            "border-b border-border/30 hover:bg-muted/20 transition-colors",
                                            isOverdue && "bg-red-50/50 dark:bg-red-950/20 border-l-2 border-l-red-500",
                                            isCritical && "bg-red-50/30 dark:bg-red-950/10 border-l-2 border-l-amber-500",
                                        )}
                                    >
                                        <td className="px-4 py-3">
                                            <p className={cn("text-sm font-medium", isOverdue ? "text-red-700 dark:text-red-300" : "text-foreground")}>{d.title}</p>
                                            {d.projectTitle && (
                                                <p className="text-[11px] text-muted-foreground mt-0.5">📁 {d.projectTitle}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-muted-foreground capitalize">{d.deadlineType.replace(/_/g, " ")}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn("text-sm", isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground")}>
                                                {format(parseISO(d.dueAt), "MMM d, yyyy")}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                {format(parseISO(d.dueAt), "h:mm a")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <UrgencyBadge countdown={countdown} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <DeadlineStatusBadge status={d.status as DeadlineStatus} priority={d.priority as DeadlinePriority} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Select value={d.status} onValueChange={v => handleStatusChange(d, v as DeadlineStatus)}>
                                                <SelectTrigger className="h-7 w-[120px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                    <SelectItem value="missed">Missed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => { setEditingDeadline(d); setDeadlineModalOpen(true) }}
                                            >
                                                Edit
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <DeadlineModal
                open={deadlineModalOpen}
                onOpenChange={setDeadlineModalOpen}
                deadline={editingDeadline}
                defaultDate={defaultDate}
                onSave={handleSaveDeadline}
                onDelete={handleDeleteDeadline}
                onFetchAudit={cal.fetchAuditTrail}
                onCreateChain={handleCreateChain}
            />
        </div>
    )
}
