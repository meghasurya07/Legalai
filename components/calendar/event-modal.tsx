"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Loader2, FolderOpen, Repeat, Scale, AlertTriangle } from "lucide-react"
import { useDocuments } from "@/context/vault-context"
import type { CalendarEvent, CalendarEventType } from "@/types"
import { format } from "date-fns"

interface ConflictInfo {
    id: string
    title: string
    startAt: string
    endAt: string
}

interface EventModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    event?: CalendarEvent | null
    defaultDate?: Date
    onSave: (data: Partial<CalendarEvent>) => Promise<{ conflict?: boolean; conflicts?: ConflictInfo[] } | void>
    onForceSave?: (data: Partial<CalendarEvent>) => Promise<void>
    onDelete?: (id: string) => Promise<void>
}

const EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
    { value: "meeting", label: "🤝 Meeting" },
    { value: "hearing", label: "⚖️ Hearing" },
    { value: "deposition", label: "📋 Deposition" },
    { value: "filing", label: "📄 Filing" },
    { value: "consultation", label: "💬 Consultation" },
    { value: "internal", label: "🏢 Internal" },
    { value: "other", label: "📌 Other" },
]

const RECURRENCE_OPTIONS = [
    { value: "none", label: "Does not repeat" },
    { value: "FREQ=DAILY", label: "Every day" },
    { value: "FREQ=WEEKLY", label: "Every week" },
    { value: "FREQ=WEEKLY;INTERVAL=2", label: "Every 2 weeks" },
    { value: "FREQ=MONTHLY", label: "Every month" },
    { value: "FREQ=YEARLY", label: "Every year" },
    { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Every weekday (Mon–Fri)" },
]

export function EventModal({ open, onOpenChange, event, defaultDate, onSave, onForceSave, onDelete }: EventModalProps) {
    const isEdit = !!event
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const { projects } = useDocuments()

    const [title, setTitle] = useState("")
    const [eventType, setEventType] = useState<CalendarEventType>("meeting")
    const [date, setDate] = useState("")
    const [startTime, setStartTime] = useState("09:00")
    const [endTime, setEndTime] = useState("10:00")
    const [allDay, setAllDay] = useState(false)
    const [location, setLocation] = useState("")
    const [description, setDescription] = useState("")
    const [projectId, setProjectId] = useState<string>("none")
    const [recurrence, setRecurrence] = useState<string>("none")
    const [caseNumber, setCaseNumber] = useState("")
    const [courtName, setCourtName] = useState("")
    const [judgeName, setJudgeName] = useState("")
    const [showCourtFields, setShowCourtFields] = useState(false)

    // Conflict state
    const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
    const [showConflictWarning, setShowConflictWarning] = useState(false)
    const [pendingData, setPendingData] = useState<Partial<CalendarEvent> | null>(null)

    useEffect(() => {
        if (event) {
            setTitle(event.title)
            setEventType(event.eventType)
            setDate(format(new Date(event.startAt), "yyyy-MM-dd"))
            setStartTime(format(new Date(event.startAt), "HH:mm"))
            setEndTime(event.endAt ? format(new Date(event.endAt), "HH:mm") : "10:00")
            setAllDay(event.allDay)
            setLocation(event.location || "")
            setDescription(event.description || "")
            setProjectId(event.projectId || "none")
            setRecurrence(event.recurrenceRule || "none")
            setCaseNumber(event.caseNumber || "")
            setCourtName(event.courtName || "")
            setJudgeName(event.judgeName || "")
            setShowCourtFields(!!(event.caseNumber || event.courtName || event.judgeName))
        } else {
            const d = defaultDate || new Date()
            setTitle("")
            setEventType("meeting")
            setDate(format(d, "yyyy-MM-dd"))
            setStartTime("09:00")
            setEndTime("10:00")
            setAllDay(false)
            setLocation("")
            setDescription("")
            setProjectId("none")
            setRecurrence("none")
            setCaseNumber("")
            setCourtName("")
            setJudgeName("")
            setShowCourtFields(false)
        }
        setConflicts([])
        setShowConflictWarning(false)
        setPendingData(null)
    }, [event, defaultDate, open])

    const buildEventData = (): Partial<CalendarEvent> => {
        const startAt = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`
        const endAt = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`

        return {
            ...(event ? { id: event.id } : {}),
            title: title.trim(),
            eventType,
            startAt: new Date(startAt).toISOString(),
            endAt: new Date(endAt).toISOString(),
            allDay,
            location: location.trim() || undefined,
            description: description.trim() || undefined,
            projectId: projectId === "none" ? null : projectId,
            recurrenceRule: recurrence === "none" ? undefined : recurrence,
            caseNumber: caseNumber.trim() || null,
            courtName: courtName.trim() || null,
            judgeName: judgeName.trim() || null,
        }
    }

    const handleSave = async () => {
        if (!title.trim() || !date) return
        setIsSaving(true)
        try {
            const data = buildEventData()
            const result = await onSave(data)

            // Check for conflict response
            if (result && "conflict" in result && result.conflict && result.conflicts) {
                setConflicts(result.conflicts)
                setPendingData(data)
                setShowConflictWarning(true)
                setIsSaving(false)
                return
            }

            onOpenChange(false)
        } catch {
            // error handled by caller
        } finally {
            setIsSaving(false)
        }
    }

    const handleForceCreate = async () => {
        if (!pendingData || !onForceSave) return
        setIsSaving(true)
        try {
            await onForceSave(pendingData)
            onOpenChange(false)
        } catch {
            // error handled by caller
        } finally {
            setIsSaving(false)
            setShowConflictWarning(false)
        }
    }

    const handleDelete = async () => {
        if (!event || !onDelete) return
        setIsDeleting(true)
        try {
            await onDelete(event.id)
            onOpenChange(false)
        } catch {
            // error handled by caller
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Event" : "New Event"}</DialogTitle>
                </DialogHeader>

                {/* Conflict Warning Banner */}
                {showConflictWarning && conflicts.length > 0 && (
                    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            Schedule Conflict Detected
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            This event overlaps with {conflicts.length} existing event{conflicts.length > 1 ? "s" : ""}:
                        </p>
                        {conflicts.map(c => (
                            <div key={c.id} className="text-xs text-amber-700 dark:text-amber-400 pl-4">
                                • <strong>{c.title}</strong> ({format(new Date(c.startAt), "h:mm a")} – {format(new Date(c.endAt), "h:mm a")})
                            </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowConflictWarning(false)}>
                                Go Back & Fix
                            </Button>
                            <Button size="sm" className="text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleForceCreate} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                Create Anyway
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-4 pt-2">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="event-title">Title</Label>
                        <Input
                            id="event-title"
                            placeholder="e.g. Client meeting, Court hearing..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Type + Project row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Event Type</Label>
                            <Select value={eventType} onValueChange={v => setEventType(v as CalendarEventType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {EVENT_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5">
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                Link to Project
                            </Label>
                            <Select value={projectId} onValueChange={setProjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No project" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No project</SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>📁 {p.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                        <Label htmlFor="event-date">Date</Label>
                        <Input
                            id="event-date"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>

                    {/* All day toggle */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="all-day">All Day</Label>
                        <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
                    </div>

                    {/* Time (hidden if all-day) */}
                    {!allDay && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="start-time">Start Time</Label>
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="end-time">End Time</Label>
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={endTime}
                                    onChange={e => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Recurrence */}
                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5">
                            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                            Repeat
                        </Label>
                        <Select value={recurrence} onValueChange={setRecurrence}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RECURRENCE_OPTIONS.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Location */}
                    <div className="space-y-1.5">
                        <Label htmlFor="event-location">Location</Label>
                        <Input
                            id="event-location"
                            placeholder="e.g. Conference Room A, Court #3..."
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                    </div>

                    {/* Court/Matter Fields (collapsible) */}
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setShowCourtFields(!showCourtFields)}
                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Scale className="h-3.5 w-3.5" />
                            {showCourtFields ? "Hide" : "Add"} Court & Case Details
                        </button>
                        {showCourtFields && (
                            <div className="space-y-3 pl-5 border-l-2 border-border/50">
                                <div className="space-y-1.5">
                                    <Label htmlFor="case-number" className="text-xs">Case / Matter Number</Label>
                                    <Input
                                        id="case-number"
                                        placeholder="e.g. 2026-CV-12345"
                                        value={caseNumber}
                                        onChange={e => setCaseNumber(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="court-name" className="text-xs">Court Name</Label>
                                    <Input
                                        id="court-name"
                                        placeholder="e.g. LA County Superior Court"
                                        value={courtName}
                                        onChange={e => setCourtName(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="judge-name" className="text-xs">Judge Name</Label>
                                    <Input
                                        id="judge-name"
                                        placeholder="e.g. Hon. Jane Smith"
                                        value={judgeName}
                                        onChange={e => setJudgeName(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="event-desc">Description</Label>
                        <Textarea
                            id="event-desc"
                            placeholder="Add notes..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4">
                    <div>
                        {isEdit && onDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={handleDelete}
                                disabled={isDeleting || isSaving}
                            >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                Delete
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving || !title.trim()}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            {isEdit ? "Save Changes" : "Create Event"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
