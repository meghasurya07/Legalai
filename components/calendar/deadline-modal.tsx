"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, FolderOpen, Bell, Scale, History, Clock } from "lucide-react"
import { useDocuments } from "@/context/vault-context"
import { DeadlineChainSuggestion } from "./deadline-chain-suggestion"
import type { Deadline, DeadlineType, DeadlinePriority, DeadlineAuditEntry } from "@/types"
import { format, formatDistanceToNow } from "date-fns"

interface DeadlineModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    deadline?: Deadline | null
    defaultDate?: Date
    onSave: (data: Partial<Deadline>) => Promise<void>
    onDelete?: (id: string) => Promise<void>
    onFetchAudit?: (id: string) => Promise<DeadlineAuditEntry[]>
    onCreateChain?: (deadlines: Partial<Deadline>[]) => Promise<unknown>
}

const DEADLINE_TYPES: { value: DeadlineType; label: string }[] = [
    { value: "filing", label: "📄 Filing" },
    { value: "statute_of_limitations", label: "⏳ Statute of Limitations" },
    { value: "discovery", label: "🔍 Discovery" },
    { value: "motion", label: "⚖️ Motion" },
    { value: "response", label: "📝 Response" },
    { value: "compliance", label: "✅ Compliance" },
    { value: "custom", label: "📌 Custom" },
]

const PRIORITIES: { value: DeadlinePriority; label: string }[] = [
    { value: "critical", label: "🔴 Critical — Must not miss" },
    { value: "high", label: "🟠 High — Urgent" },
    { value: "medium", label: "🟡 Medium — Standard" },
    { value: "low", label: "🟢 Low — Flexible" },
]

const REMIND_OPTIONS = [
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 120, label: "2 hours before" },
    { value: 1440, label: "1 day before" },
    { value: 2880, label: "2 days before" },
    { value: 10080, label: "1 week before" },
    { value: 20160, label: "2 weeks before" },
]

const AUDIT_ACTION_LABELS: Record<string, string> = {
    created: "Created",
    status_changed: "Status changed",
    field_updated: "Updated",
    deleted: "Deleted",
}

export function DeadlineModal({ open, onOpenChange, deadline, defaultDate, onSave, onDelete, onFetchAudit, onCreateChain }: DeadlineModalProps) {
    const isEdit = !!deadline
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const { projects } = useDocuments()

    const [title, setTitle] = useState("")
    const [deadlineType, setDeadlineType] = useState<DeadlineType>("filing")
    const [date, setDate] = useState("")
    const [time, setTime] = useState("17:00")
    const [priority, setPriority] = useState<DeadlinePriority>("medium")
    const [description, setDescription] = useState("")
    const [projectId, setProjectId] = useState<string>("none")
    const [remindBefore, setRemindBefore] = useState<number>(1440)
    const [caseNumber, setCaseNumber] = useState("")
    const [courtName, setCourtName] = useState("")
    const [judgeName, setJudgeName] = useState("")
    const [showCourtFields, setShowCourtFields] = useState(false)

    // Audit trail
    const [auditLog, setAuditLog] = useState<DeadlineAuditEntry[]>([])
    const [showAudit, setShowAudit] = useState(false)
    const [isAuditLoading, setIsAuditLoading] = useState(false)

    useEffect(() => {
        if (deadline) {
            setTitle(deadline.title)
            setDeadlineType(deadline.deadlineType)
            setDate(format(new Date(deadline.dueAt), "yyyy-MM-dd"))
            setTime(format(new Date(deadline.dueAt), "HH:mm"))
            setPriority(deadline.priority)
            setDescription(deadline.description || "")
            setProjectId(deadline.projectId || "none")
            setRemindBefore(deadline.remindBeforeMinutes || 1440)
            setCaseNumber(deadline.caseNumber || "")
            setCourtName(deadline.courtName || "")
            setJudgeName(deadline.judgeName || "")
            setShowCourtFields(!!(deadline.caseNumber || deadline.courtName || deadline.judgeName))
        } else {
            const d = defaultDate || new Date()
            setTitle("")
            setDeadlineType("filing")
            setDate(format(d, "yyyy-MM-dd"))
            setTime("17:00")
            setPriority("medium")
            setDescription("")
            setProjectId("none")
            setRemindBefore(1440)
            setCaseNumber("")
            setCourtName("")
            setJudgeName("")
            setShowCourtFields(false)
        }
        setAuditLog([])
        setShowAudit(false)
    }, [deadline, defaultDate, open])

    // Load audit trail
    const loadAudit = async () => {
        if (!deadline || !onFetchAudit) return
        setIsAuditLoading(true)
        try {
            const entries = await onFetchAudit(deadline.id)
            setAuditLog(entries)
            setShowAudit(true)
        } finally {
            setIsAuditLoading(false)
        }
    }

    const handleSave = async () => {
        if (!title.trim() || !date) return
        setIsSaving(true)
        try {
            await onSave({
                ...(deadline ? { id: deadline.id } : {}),
                title: title.trim(),
                deadlineType,
                dueAt: new Date(`${date}T${time}:00`).toISOString(),
                priority,
                description: description.trim() || undefined,
                projectId: projectId === "none" ? null : projectId,
                remindBeforeMinutes: remindBefore,
                caseNumber: caseNumber.trim() || null,
                courtName: courtName.trim() || null,
                judgeName: judgeName.trim() || null,
            })
            onOpenChange(false)
        } catch {
            // error handled by caller
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deadline || !onDelete) return
        setIsDeleting(true)
        try {
            await onDelete(deadline.id)
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
                    <DialogTitle>{isEdit ? "Edit Deadline" : "New Deadline"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="dl-title">Title</Label>
                        <Input
                            id="dl-title"
                            placeholder="e.g. Motion to Dismiss deadline..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Type & Priority */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Deadline Type</Label>
                            <Select value={deadlineType} onValueChange={v => setDeadlineType(v as DeadlineType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEADLINE_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={v => setPriority(v as DeadlinePriority)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORITIES.map(p => (
                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Project Linking */}
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

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="dl-date">Due Date</Label>
                            <Input
                                id="dl-date"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dl-time">Due Time</Label>
                            <Input
                                id="dl-time"
                                type="time"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Remind Before */}
                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5">
                            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                            Remind Before
                        </Label>
                        <Select value={String(remindBefore)} onValueChange={v => setRemindBefore(Number(v))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {REMIND_OPTIONS.map(r => (
                                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Court/Case Details (collapsible) */}
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
                                    <Label htmlFor="dl-case" className="text-xs">Case / Matter Number</Label>
                                    <Input
                                        id="dl-case"
                                        placeholder="e.g. 2026-CV-12345"
                                        value={caseNumber}
                                        onChange={e => setCaseNumber(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="dl-court" className="text-xs">Court Name</Label>
                                    <Input
                                        id="dl-court"
                                        placeholder="e.g. LA County Superior Court"
                                        value={courtName}
                                        onChange={e => setCourtName(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="dl-judge" className="text-xs">Judge Name</Label>
                                    <Input
                                        id="dl-judge"
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
                        <Label htmlFor="dl-desc">Description</Label>
                        <Textarea
                            id="dl-desc"
                            placeholder="Additional notes or context..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Smart Deadline Chain (new deadlines only) */}
                    {!isEdit && onCreateChain && date && (
                        <DeadlineChainSuggestion
                            deadlineType={deadlineType}
                            baseDate={new Date(`${date}T${time}:00`)}
                            projectId={projectId === "none" ? null : projectId}
                            caseNumber={caseNumber || null}
                            courtName={courtName || null}
                            judgeName={judgeName || null}
                            onCreateChain={async (items) => {
                                await onCreateChain(items as Partial<Deadline>[])
                            }}
                        />
                    )}

                    {/* Audit Trail (edit mode only) */}
                    {isEdit && onFetchAudit && (
                        <div className="space-y-2 pt-2 border-t border-border/30">
                            <button
                                type="button"
                                onClick={() => showAudit ? setShowAudit(false) : loadAudit()}
                                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <History className="h-3.5 w-3.5" />
                                {isAuditLoading ? "Loading..." : showAudit ? "Hide" : "View"} Change History
                            </button>
                            {showAudit && auditLog.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto pl-5 border-l-2 border-border/50">
                                    {auditLog.map(entry => (
                                        <div key={entry.id} className="flex items-start gap-2 text-[11px] text-muted-foreground py-1">
                                            <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                                            <div>
                                                <span className="font-medium text-foreground/80">{entry.userName || "System"}</span>
                                                {" "}
                                                <span>{AUDIT_ACTION_LABELS[entry.action] || entry.action}</span>
                                                {entry.fieldChanged && (
                                                    <>
                                                        {" "}<span className="font-mono bg-muted px-1 rounded">{entry.fieldChanged.replace(/_/g, " ")}</span>
                                                    </>
                                                )}
                                                {entry.oldValue && entry.newValue && (
                                                    <span className="block mt-0.5">
                                                        <span className="line-through text-red-400">{entry.oldValue}</span>
                                                        {" → "}
                                                        <span className="text-emerald-400">{entry.newValue}</span>
                                                    </span>
                                                )}
                                                <span className="block text-[10px] opacity-60">
                                                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showAudit && auditLog.length === 0 && (
                                <p className="text-xs text-muted-foreground pl-5">No changes recorded yet.</p>
                            )}
                        </div>
                    )}
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
                            {isEdit ? "Save Changes" : "Create Deadline"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
