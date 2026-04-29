"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Sparkles, FolderOpen } from "lucide-react"
import { MEMORY_TYPES, ImportanceStars } from "./memory-card"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────

interface Project {
    id: string
    title: string
}

// ─── Main Component ──────────────────────────────────────

interface AddMemoryModalProps {
    projectId?: string
    onMemoryAdded?: (memory: Record<string, unknown>) => void
    triggerButton?: React.ReactNode
}

export default function AddMemoryModal({ projectId, onMemoryAdded, triggerButton }: AddMemoryModalProps) {
    const [open, setOpen] = useState(false)
    const [content, setContent] = useState("")
    const [memoryType, setMemoryType] = useState("fact")
    const [importance, setImportance] = useState(3)
    const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || "none")
    const [projects, setProjects] = useState<Project[]>([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [saving, setSaving] = useState(false)

    // Fetch projects when modal opens (only if no fixed projectId)
    useEffect(() => {
        if (!open || projectId) return

        const fetchProjects = async () => {
            setLoadingProjects(true)
            try {
                const res = await fetch("/api/documents/projects")
                const data = await res.json()
                // API returns a flat array of projects
                const projectList = Array.isArray(data) ? data : (data.projects || [])
                setProjects(projectList)
            } catch {
                // Non-critical — project linking is optional
            } finally {
                setLoadingProjects(false)
            }
        }

        fetchProjects()
    }, [open, projectId])

    const handleSave = async () => {
        if (!content.trim()) return
        setSaving(true)

        try {
            const body: Record<string, unknown> = {
                content: content.trim(),
                memoryType,
                importance,
            }
            // Use fixed projectId prop, or user-selected one
            const effectiveProjectId = projectId || (selectedProjectId !== "none" ? selectedProjectId : null)
            if (effectiveProjectId) body.projectId = effectiveProjectId

            const res = await fetch("/api/memory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (data.memory) {
                toast.success("Memory added successfully")
                onMemoryAdded?.(data.memory)
                setOpen(false)
                resetForm()
            } else {
                toast.error(data.error?.message || "Failed to add memory")
            }
        } catch {
            toast.error("Failed to add memory")
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => {
        setContent("")
        setMemoryType("fact")
        setImportance(3)
        setSelectedProjectId(projectId || "none")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <Button size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Add Memory
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Add Memory
                    </DialogTitle>
                    <DialogDescription>
                        Save a fact, decision, or preference that Wesley should remember.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Content */}
                    <div className="space-y-2">
                        <Label>Memory Content</Label>
                        <Textarea
                            placeholder="e.g., Governing law for this deal should be New York law per client's instruction..."
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={4}
                            className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Describe a fact, decision, preference, or insight that Wesley should remember.
                        </p>
                    </div>

                    {/* Type selector */}
                    <div className="space-y-2">
                        <Label>Memory Type</Label>
                        <Select value={memoryType} onValueChange={setMemoryType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MEMORY_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${t.color.split(' ')[0].replace('/10', '')}`} />
                                            {t.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Project link (optional) — only shown when not pre-scoped to a project */}
                    {!projectId && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1.5">
                                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                    Link to Project
                                </Label>
                                <span className="text-[11px] text-muted-foreground">Optional</span>
                            </div>
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingProjects ? "Loading projects..." : "No project (global memory)"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        <span className="text-muted-foreground">No project (global memory)</span>
                                    </SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Link this memory to a specific document project for context-aware recall.
                            </p>
                        </div>
                    )}

                    {/* Importance */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Importance</Label>
                            <span className="text-xs text-muted-foreground">
                                {importance <= 2 ? 'Low' : importance <= 3 ? 'Medium' : importance >= 5 ? 'Critical' : 'High'}
                            </span>
                        </div>
                        <div className="flex items-center justify-center py-2">
                            <ImportanceStars value={importance} onChange={setImportance} />
                        </div>
                    </div>

                    {/* Save */}
                    <Button
                        onClick={handleSave}
                        className="w-full"
                        disabled={!content.trim() || saving}
                    >
                        {saving ? "Saving..." : "Save Memory"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
