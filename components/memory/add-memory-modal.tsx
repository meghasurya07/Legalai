"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Sparkles } from "lucide-react"
import { MEMORY_TYPES, ImportanceStars } from "./memory-card"
import { toast } from "sonner"

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
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!content.trim()) return
        setSaving(true)

        try {
            const body: Record<string, unknown> = {
                content: content.trim(),
                memoryType,
                importance,
            }
            if (projectId) body.projectId = projectId

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
