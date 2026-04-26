"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
    format, isSameDay, parseISO
} from "date-fns"
import type { CalendarEvent, Deadline, CalendarItem, CalendarView, DeadlineAuditEntry } from "@/types"

// Color mapping for event types
const EVENT_TYPE_COLORS: Record<string, string> = {
    meeting: "#3b82f6",       // blue
    hearing: "#8b5cf6",       // violet
    deposition: "#6366f1",    // indigo
    filing: "#f59e0b",        // amber
    consultation: "#06b6d4",  // cyan
    internal: "#64748b",      // slate
    other: "#78716c",         // stone
}

const DEADLINE_PRIORITY_COLORS: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#16a34a",
}

interface CalendarStats {
    upcoming: number
    overdue: number
    dueThisWeek: number
    completedThisMonth: number
}

interface ConflictInfo {
    id: string
    title: string
    startAt: string
    endAt: string
}

export type CalendarScope = "personal" | "firm"

export function useCalendar() {
    const [view, setView] = useState<CalendarView>("month")
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [deadlines, setDeadlines] = useState<Deadline[]>([])
    const [stats, setStats] = useState<CalendarStats>({ upcoming: 0, overdue: 0, dueThisWeek: 0, completedThisMonth: 0 })
    const [isLoading, setIsLoading] = useState(false)
    const [isStatsLoading, setIsStatsLoading] = useState(false)
    const [scope, setScope] = useState<CalendarScope>("personal")
    const [orgId, setOrgId] = useState<string | null>(null)

    // Compute date range based on current view
    const dateRange = useMemo(() => {
        switch (view) {
            case "month": {
                const monthStart = startOfMonth(currentDate)
                const monthEnd = endOfMonth(currentDate)
                return {
                    start: startOfWeek(monthStart),
                    end: endOfWeek(monthEnd),
                }
            }
            case "week":
                return {
                    start: startOfWeek(currentDate),
                    end: endOfWeek(currentDate),
                }
            case "day":
                return {
                    start: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0),
                    end: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59),
                }
            case "agenda":
                return {
                    start: new Date(),
                    end: addDays(new Date(), 30),
                }
        }
    }, [view, currentDate])

    // Fetch events + deadlines for the current range
    const fetchRange = useCallback(async () => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                start: dateRange.start.toISOString(),
                end: dateRange.end.toISOString(),
                scope,
            })
            if (scope === "firm" && orgId) params.set("orgId", orgId)

            const [eventsRes, deadlinesRes] = await Promise.all([
                fetch(`/api/calendar/events?${params}`),
                fetch(`/api/calendar/deadlines?${params}`),
            ])

            if (eventsRes.ok) {
                const data = await eventsRes.json()
                setEvents(data)
            }
            if (deadlinesRes.ok) {
                const data = await deadlinesRes.json()
                setDeadlines(data)
            }
        } catch (err) {
            console.error("Failed to fetch calendar data:", err)
        } finally {
            setIsLoading(false)
        }
    }, [dateRange, scope, orgId])

    // Fetch stats
    const fetchStats = useCallback(async () => {
        setIsStatsLoading(true)
        try {
            const res = await fetch("/api/calendar/stats")
            if (res.ok) setStats(await res.json())
        } catch {
            // silently fail
        } finally {
            setIsStatsLoading(false)
        }
    }, [])

    // Auto-fetch on date/view/scope change
    useEffect(() => {
        fetchRange()
    }, [fetchRange])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    // Merge events + deadlines into unified CalendarItems
    const calendarItems: CalendarItem[] = useMemo(() => {
        const eventItems: CalendarItem[] = events.map(e => ({
            id: e.id,
            kind: "event",
            title: e.title,
            date: format(parseISO(e.startAt), "yyyy-MM-dd"),
            startAt: e.startAt,
            endAt: e.endAt,
            allDay: e.allDay,
            type: e.eventType,
            color: e.color || EVENT_TYPE_COLORS[e.eventType] || "#64748b",
            projectTitle: e.projectTitle,
            projectId: e.projectId,
            location: e.location,
            description: e.description,
            caseNumber: e.caseNumber,
            courtName: e.courtName,
            judgeName: e.judgeName,
        }))

        const deadlineItems: CalendarItem[] = deadlines.map(d => ({
            id: d.id,
            kind: "deadline",
            title: d.title,
            date: format(parseISO(d.dueAt), "yyyy-MM-dd"),
            startAt: d.dueAt,
            endAt: undefined,
            allDay: true,
            type: d.deadlineType,
            priority: d.priority,
            status: d.status,
            color: DEADLINE_PRIORITY_COLORS[d.priority] || "#ca8a04",
            projectTitle: d.projectTitle,
            projectId: d.projectId,
            description: d.description,
            caseNumber: d.caseNumber,
            courtName: d.courtName,
            judgeName: d.judgeName,
        }))

        return [...eventItems, ...deadlineItems].sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        )
    }, [events, deadlines])

    // Get items for a specific day
    const getItemsForDay = useCallback((date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd")
        return calendarItems.filter(item => item.date === dateStr)
    }, [calendarItems])

    // Navigation
    const goToday = () => setCurrentDate(new Date())
    const goNext = () => {
        switch (view) {
            case "month": setCurrentDate(prev => addMonths(prev, 1)); break
            case "week": setCurrentDate(prev => addWeeks(prev, 1)); break
            case "day": setCurrentDate(prev => addDays(prev, 1)); break
            case "agenda": setCurrentDate(prev => addDays(prev, 30)); break
        }
    }
    const goPrev = () => {
        switch (view) {
            case "month": setCurrentDate(prev => subMonths(prev, 1)); break
            case "week": setCurrentDate(prev => subWeeks(prev, 1)); break
            case "day": setCurrentDate(prev => subDays(prev, 1)); break
            case "agenda": setCurrentDate(prev => subDays(prev, 30)); break
        }
    }

    // CRUD: Events (with conflict detection)
    const createEvent = async (event: Partial<CalendarEvent>): Promise<CalendarEvent & { conflict?: boolean; conflicts?: ConflictInfo[] }> => {
        const res = await fetch("/api/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
        })

        const data = await res.json()

        // Handle conflict response (409)
        if (res.status === 409 && data.conflict) {
            return data // Return conflict info for UI to handle
        }

        if (!res.ok) throw new Error("Failed to create event")
        setEvents(prev => [...prev, data])
        fetchStats()
        return data
    }

    // Force-create event (bypass conflict check)
    const forceCreateEvent = async (event: Partial<CalendarEvent>) => {
        const res = await fetch("/api/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...event, forceCreate: true }),
        })
        if (!res.ok) throw new Error("Failed to create event")
        const created = await res.json()
        setEvents(prev => [...prev, created])
        fetchStats()
        return created
    }

    const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
        const res = await fetch(`/api/calendar/events/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
        })
        if (!res.ok) throw new Error("Failed to update event")
        const updated = await res.json()
        setEvents(prev => prev.map(e => e.id === id ? updated : e))
        return updated
    }

    const deleteEvent = async (id: string) => {
        const res = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete event")
        setEvents(prev => prev.filter(e => e.id !== id))
        fetchStats()
    }

    // CRUD: Deadlines
    const createDeadline = async (deadline: Partial<Deadline>) => {
        const res = await fetch("/api/calendar/deadlines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deadline),
        })
        if (!res.ok) throw new Error("Failed to create deadline")
        const created = await res.json()
        setDeadlines(prev => [...prev, created])
        fetchStats()
        return created
    }

    const updateDeadline = async (id: string, updates: Partial<Deadline>) => {
        const res = await fetch(`/api/calendar/deadlines/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
        })
        if (!res.ok) throw new Error("Failed to update deadline")
        const updated = await res.json()
        setDeadlines(prev => prev.map(d => d.id === id ? updated : d))
        fetchStats()
        return updated
    }

    const deleteDeadline = async (id: string) => {
        const res = await fetch(`/api/calendar/deadlines/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete deadline")
        setDeadlines(prev => prev.filter(d => d.id !== id))
        fetchStats()
    }

    // Fetch audit trail for a deadline
    const fetchAuditTrail = async (deadlineId: string): Promise<DeadlineAuditEntry[]> => {
        const res = await fetch(`/api/calendar/deadlines/${deadlineId}/audit`)
        if (!res.ok) return []
        return res.json()
    }

    // Batch create deadlines (for chains)
    const createDeadlineChain = async (deadlines: Partial<Deadline>[]) => {
        const res = await fetch("/api/calendar/deadlines/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deadlines }),
        })
        if (!res.ok) throw new Error("Failed to create deadline chain")
        const result = await res.json()
        // Add all new deadlines to local state
        if (result.deadlines) {
            setDeadlines(prev => [...prev, ...result.deadlines])
        }
        fetchStats()
        return result
    }

    // AI: Extract dates from document text
    const extractDatesFromText = async (text: string, projectId?: string) => {
        const res = await fetch("/api/calendar/extract-dates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, projectId }),
        })
        if (!res.ok) throw new Error("Failed to extract dates")
        return res.json()
    }

    // Check if a date is today
    const isToday = useCallback((date: Date) => isSameDay(date, new Date()), [])

    return {
        // State
        view, setView,
        currentDate, setCurrentDate,
        events, deadlines,
        calendarItems,
        stats,
        isLoading,
        isStatsLoading,
        dateRange,
        scope, setScope,
        orgId, setOrgId,

        // Methods
        fetchRange,
        fetchStats,
        getItemsForDay,
        goToday, goNext, goPrev,
        createEvent, forceCreateEvent, updateEvent, deleteEvent,
        createDeadline, updateDeadline, deleteDeadline,
        createDeadlineChain,
        extractDatesFromText,
        fetchAuditTrail,
        isToday,
    }
}
