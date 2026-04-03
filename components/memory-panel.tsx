"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import {
    Brain,
    Search,
    Pin,
    PinOff,
    Trash2,
    Plus,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Save,
    X,
    AlertTriangle,
    CheckCircle2,
    Info,
    Sparkles,
    TrendingUp,
    Archive,
    Filter,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────

interface Memory {
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

interface MemoryStats {
    total: number
    active: number
    stale: number
    pinned: number
    by_type: Record<string, number>
    by_source: Record<string, number>
}

const MEMORY_TYPES = [
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

function getTypeStyle(type: string) {
    return MEMORY_TYPES.find(t => t.value === type)?.color || "bg-muted text-muted-foreground"
}

function getTypeLabel(type: string) {
    return MEMORY_TYPES.find(t => t.value === type)?.label || type
}

function formatDate(dateStr: string): string {
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

function ImportanceStars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
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

function ConfidenceIndicator({ value }: { value: number }) {
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

// ─── Main Component ──────────────────────────────────────

interface MemoryPanelProps {
    projectId: string
}

export default function MemoryPanel({ projectId }: MemoryPanelProps) {
    const [memories, setMemories] = useState<Memory[]>([])
    const [stats, setStats] = useState<MemoryStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState<string>("all")
    const [sortBy, setSortBy] = useState("created_at")
    const [sortOrder, setSortOrder] = useState("desc")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [newMemory, setNewMemory] = useState({ content: "", memory_type: "fact", importance: 3 })

    // Fetch memories
    const fetchMemories = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                projectId,
                page: String(page),
                limit: "15",
                sortBy,
                order: sortOrder,
            })
            if (filterType !== "all") params.set("type", filterType)
            if (search.trim()) params.set("search", search.trim())

            const res = await fetch(`/api/memory?${params}`)
            const data = await res.json()
            setMemories(data.memories || [])
            setTotal(data.total || 0)
            setTotalPages(data.totalPages || 1)
        } catch {
            toast.error("Failed to load memories")
        } finally {
            setLoading(false)
        }
    }, [projectId, page, filterType, sortBy, sortOrder, search])

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/memory/stats?projectId=${projectId}`)
            const data = await res.json()
            setStats(data.stats || null)
        } catch {
            // Non-critical
        }
    }, [projectId])

    useEffect(() => {
        fetchMemories()
        fetchStats()
    }, [fetchMemories, fetchStats])

    // Pin/unpin
    const togglePin = async (mem: Memory) => {
        try {
            await fetch(`/api/memory/${mem.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_pinned: !mem.is_pinned }),
            })
            setMemories(prev => prev.map(m =>
                m.id === mem.id ? { ...m, is_pinned: !m.is_pinned } : m
            ))
            toast.success(mem.is_pinned ? "Memory unpinned" : "Memory pinned")
        } catch {
            toast.error("Failed to update memory")
        }
    }

    // Delete
    const deleteMemory = async (id: string) => {
        try {
            await fetch(`/api/memory/${id}`, { method: "DELETE" })
            setMemories(prev => prev.filter(m => m.id !== id))
            setTotal(prev => prev - 1)
            toast.success("Memory removed")
        } catch {
            toast.error("Failed to delete memory")
        }
    }

    // Save edit
    const saveEdit = async (id: string) => {
        try {
            const res = await fetch(`/api/memory/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: editContent }),
            })
            const data = await res.json()
            if (data.memory) {
                setMemories(prev => prev.map(m => m.id === id ? { ...m, ...data.memory } : m))
                toast.success("Memory updated")
            }
            setEditingId(null)
        } catch {
            toast.error("Failed to update memory")
        }
    }

    // Add new memory
    const addMemory = async () => {
        if (!newMemory.content.trim()) return
        try {
            const res = await fetch("/api/memory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, ...newMemory }),
            })
            const data = await res.json()
            if (data.memory) {
                setMemories(prev => [data.memory, ...prev])
                setTotal(prev => prev + 1)
                toast.success("Memory added")
                setShowAddDialog(false)
                setNewMemory({ content: "", memory_type: "fact", importance: 3 })
            }
        } catch {
            toast.error("Failed to add memory")
        }
    }

    return (
        <div className="space-y-6">
            {/* ─── Stats Dashboard ─── */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2">
                                <Brain className="h-4 w-4 text-primary" />
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Active</span>
                            </div>
                            <p className="text-2xl font-bold mt-1">{stats.active}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2">
                                <Pin className="h-4 w-4 text-amber-500" />
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Pinned</span>
                            </div>
                            <p className="text-2xl font-bold mt-1">{stats.pinned}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Learning</span>
                            </div>
                            <p className="text-2xl font-bold mt-1">
                                {Object.values(stats.by_type).reduce((a, b) => a + b, 0) > 0
                                    ? Object.keys(stats.by_type).length
                                    : 0}
                                <span className="text-sm font-normal text-muted-foreground ml-1">types</span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2">
                                <Archive className="h-4 w-4 text-red-500" />
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Stale</span>
                            </div>
                            <p className="text-2xl font-bold mt-1">{stats.stale}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── Controls ─── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search memories..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9"
                        />
                    </div>
                    <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1) }}>
                        <SelectTrigger className="w-[140px]">
                            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            {MEMORY_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_at">Date</SelectItem>
                            <SelectItem value="importance">Importance</SelectItem>
                            <SelectItem value="confidence">Confidence</SelectItem>
                            <SelectItem value="reinforcement_count">Usage</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                        className="h-9 w-9"
                    >
                        <TrendingUp className={`h-4 w-4 transition-transform ${sortOrder === "asc" ? "" : "rotate-180"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { fetchMemories(); fetchStats() }} className="h-9 w-9">
                        <RefreshCw className="h-4 w-4" />
                    </Button>

                    {/* Add Memory Dialog */}
                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-1.5">
                                <Plus className="h-3.5 w-3.5" />
                                Add
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                    Add Memory
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Content</Label>
                                    <Textarea
                                        placeholder="e.g., Governing law is New York..."
                                        value={newMemory.content}
                                        onChange={e => setNewMemory(p => ({ ...p, content: e.target.value }))}
                                        rows={3}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-2">
                                        <Label>Type</Label>
                                        <Select
                                            value={newMemory.memory_type}
                                            onValueChange={v => setNewMemory(p => ({ ...p, memory_type: v }))}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {MEMORY_TYPES.map(t => (
                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Importance</Label>
                                        <div className="flex items-center h-10">
                                            <ImportanceStars
                                                value={newMemory.importance}
                                                onChange={v => setNewMemory(p => ({ ...p, importance: v }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={addMemory} className="w-full" disabled={!newMemory.content.trim()}>
                                    Save Memory
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Separator />

            {/* ─── Memory List ─── */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="py-4">
                                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                                <div className="h-3 bg-muted rounded w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : memories.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No memories yet</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                            Memories are automatically extracted from your conversations and documents.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {memories.map(mem => (
                        <Card
                            key={mem.id}
                            className={`group transition-all hover:shadow-sm ${
                                mem.is_pinned ? 'border-primary/30 bg-primary/[0.02]' : ''
                            }`}
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
                                                    <Button size="sm" variant="default" onClick={() => saveEdit(mem.id)} className="gap-1 h-7 text-xs">
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
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => togglePin(mem)}
                                                    >
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
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => { setEditingId(mem.id); setEditContent(mem.content) }}
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Edit</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                        onClick={() => deleteMemory(mem.id)}
                                                    >
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
                    ))}
                </div>
            )}

            {/* ─── Pagination ─── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        {total} memor{total === 1 ? 'y' : 'ies'} total
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost" size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="h-8"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                        <Button
                            variant="ghost" size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="h-8"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
