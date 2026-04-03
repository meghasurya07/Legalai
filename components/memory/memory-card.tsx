"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Pin,
    PinOff,
    Trash2,
    Edit3,
    Save,
    X,
    AlertTriangle,
    CheckCircle2,
    Info,
    Check,
} from "lucide-react"
import { useState } from "react"

// ─── Types ───────────────────────────────────────────────

export interface MemoryItem {
    id: string
    content: string
    memory_type: string
    source: string
    importance: number
    confidence: number
    authority_weight: number
    is_pinned: boolean
    is_active: boolean
    reinforcement_count: number
    decay_weight: number
    created_at: string
    updated_at: string
    metadata: Record<string, unknown>
}

export const MEMORY_TYPES = [
    { value: "fact", label: "Fact", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    { value: "decision", label: "Decision", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
    { value: "risk", label: "Risk", color: "bg-red-500/10 text-red-500 border-red-500/20" },
    { value: "obligation", label: "Obligation", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    { value: "insight", label: "Insight", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    { value: "preference", label: "Preference", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
    { value: "argument", label: "Argument", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
    { value: "outcome", label: "Outcome", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
    { value: "procedure", label: "Procedure", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
    { value: "pattern", label: "Pattern", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
    { value: "correction", label: "Correction", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
]

export function getTypeStyle(type: string) {
    return MEMORY_TYPES.find(t => t.value === type)?.color || "bg-muted text-muted-foreground"
}

export function getTypeLabel(type: string) {
    return MEMORY_TYPES.find(t => t.value === type)?.label || type
}

export function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────

export function ImportanceStars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange?.(n)}
                    aria-label={`Importance ${n}`}
                    disabled={!onChange}
                    className={`w-3 h-3 rounded-full transition-all ${
                        n <= value
                            ? 'bg-primary shadow-sm shadow-primary/30'
                            : 'bg-muted'
                    } ${onChange ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
                />
            ))}
        </div>
    )
}

export function ConfidenceIndicator({ value }: { value: number }) {
    const pct = Math.round(value * 100)
    const color = value >= 0.8 ? 'text-emerald-500' : value >= 0.6 ? 'text-amber-500' : 'text-red-500'
    const Icon = value >= 0.8 ? CheckCircle2 : value >= 0.6 ? Info : AlertTriangle
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
                        <Icon className="h-3 w-3" />
                        {pct}%
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Confidence: {pct}%</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// ─── Main Card Component ─────────────────────────────────

interface MemoryCardProps {
    memory: MemoryItem
    onPin: (mem: MemoryItem) => void
    onDelete: (id: string) => void
    onSave: (id: string, content: string) => void
    onConfirmPreference?: (id: string) => void
}

export default function MemoryCard({ memory: mem, onPin, onDelete, onSave, onConfirmPreference }: MemoryCardProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")

    const isDetectedPreference = mem.memory_type === 'preference'
        && mem.metadata?.user_confirmed === false

    return (
        <Card
            className={`group transition-all hover:shadow-sm ${
                mem.is_pinned ? 'border-primary/30 bg-primary/[0.02]' : ''
            } ${isDetectedPreference ? 'border-pink-500/20 bg-pink-500/[0.02]' : ''}`}
        >
            <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {editingId === mem.id ? (
                            <div className="space-y-2">
                                <Textarea
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                    rows={3}
                                    className="text-sm"
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" variant="default" onClick={() => { onSave(mem.id, editContent); setEditingId(null) }} className="gap-1 h-7 text-xs">
                                        <Save className="h-3 w-3" /> Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="gap-1 h-7 text-xs">
                                        <X className="h-3 w-3" /> Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm leading-relaxed">{mem.content}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${getTypeStyle(mem.memory_type)}`}>
                                {getTypeLabel(mem.memory_type)}
                            </Badge>
                            <ImportanceStars value={mem.importance} />
                            <ConfidenceIndicator value={mem.confidence} />
                            <span className="text-[10px] text-muted-foreground/60">•</span>
                            <span className="text-[10px] text-muted-foreground/60 capitalize">{mem.source}</span>
                            <span className="text-[10px] text-muted-foreground/60">•</span>
                            <span className="text-[10px] text-muted-foreground/60">{formatDate(mem.created_at)}</span>
                            {mem.reinforcement_count > 0 && (
                                <>
                                    <span className="text-[10px] text-muted-foreground/60">•</span>
                                    <span className="text-[10px] text-emerald-500">{mem.reinforcement_count}× used</span>
                                </>
                            )}
                        </div>

                        {/* Detected preference confirm button */}
                        {isDetectedPreference && onConfirmPreference && (
                            <div className="mt-2 flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] gap-1 border-pink-500/30 text-pink-600 hover:bg-pink-500/10"
                                    onClick={() => onConfirmPreference(mem.id)}
                                >
                                    <Check className="h-3 w-3" />
                                    Confirm Preference
                                </Button>
                                <span className="text-[10px] text-muted-foreground/60">Auto-detected from your conversations</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(mem)}>
                                        {mem.is_pinned
                                            ? <PinOff className="h-3.5 w-3.5 text-primary" />
                                            : <Pin className="h-3.5 w-3.5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{mem.is_pinned ? "Unpin" : "Pin"}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                        onClick={() => { setEditingId(mem.id); setEditContent(mem.content) }}>
                                        <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => onDelete(mem.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
