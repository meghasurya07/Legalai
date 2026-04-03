"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrgMemory } from "../types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
    Users,
    Trash2,
    X,
    Brain,
    Search,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    Pin,
    PinOff,
    Edit3,
    Save,
} from "lucide-react"

export default function MemoryTab({ canManage }: { canManage: boolean }) {
    const [orgMemoryEnabled, setOrgMemoryEnabled] = useState(true)
    const [loadingToggle, setLoadingToggle] = useState(true)
    const [togglingMemory, setTogglingMemory] = useState(false)
    const [memories, setMemories] = useState<OrgMemory[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState("all")
    const [sortBy, setSortBy] = useState("created_at")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [orgStats, setOrgStats] = useState<{ totalActive: number; totalPinned: number; uniqueUsers: number } | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")

    // Fetch org-level toggle state
    useEffect(() => {
        fetch('/api/memory/toggle/org')
            .then(r => r.json())
            .then(data => {
                setOrgMemoryEnabled(data.enabled ?? true)
                setLoadingToggle(false)
            })
            .catch(() => setLoadingToggle(false))
    }, [])

    // Toggle org-level memory
    const handleOrgToggle = async (enabled: boolean) => {
        setTogglingMemory(true)
        try {
            const res = await fetch('/api/memory/toggle/org', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            })
            const data = await res.json()
            if (data.success) {
                setOrgMemoryEnabled(enabled)
                toast.success(data.message)
            } else {
                toast.error(data.error?.message || "Failed to update")
            }
        } catch {
            toast.error("Failed to update setting")
        } finally {
            setTogglingMemory(false)
        }
    }

    // Fetch org memories
    const fetchMemories = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "20",
                sortBy,
                order: "desc",
            })
            if (filterType !== "all") params.set("type", filterType)
            if (search.trim()) params.set("search", search.trim())

            const res = await fetch(`/api/memory/org?${params}`)
            const data = await res.json()
            setMemories(data.memories || [])
            setTotal(data.total || 0)
            setTotalPages(data.totalPages || 1)
            if (data.orgStats) setOrgStats(data.orgStats)
        } catch {
            toast.error("Failed to load organization memories")
        } finally {
            setLoading(false)
        }
    }, [page, filterType, sortBy, search])

    useEffect(() => {
        fetchMemories()
    }, [fetchMemories])

    // Pin/unpin
    const handlePin = async (mem: OrgMemory) => {
        try {
            await fetch(`/api/memory/${mem.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_pinned: !mem.is_pinned }),
            })
            setMemories(prev => prev.map(m =>
                m.id === mem.id ? { ...m, is_pinned: !m.is_pinned } : m
            ))
            toast.success(mem.is_pinned ? "Unpinned" : "Pinned")
        } catch {
            toast.error("Failed to update")
        }
    }

    // Delete
    const handleDelete = async (id: string) => {
        if (!confirm("Delete this memory? This action cannot be undone.")) return
        try {
            await fetch(`/api/memory/${id}`, { method: "DELETE" })
            setMemories(prev => prev.filter(m => m.id !== id))
            setTotal(prev => prev - 1)
            toast.success("Memory deleted")
        } catch {
            toast.error("Failed to delete")
        }
    }

    // Save edit
    const handleSave = async (id: string) => {
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
        } catch {
            toast.error("Failed to update")
        } finally {
            setEditingId(null)
        }
    }

    const MEMORY_TYPE_OPTIONS = [
        { value: "fact", label: "Fact" },
        { value: "decision", label: "Decision" },
        { value: "risk", label: "Risk" },
        { value: "obligation", label: "Obligation" },
        { value: "insight", label: "Insight" },
        { value: "preference", label: "Preference" },
        { value: "argument", label: "Argument" },
        { value: "outcome", label: "Outcome" },
        { value: "procedure", label: "Procedure" },
        { value: "pattern", label: "Pattern" },
        { value: "correction", label: "Correction" },
    ]

    return (
        <div className="space-y-6">
            {/* Org-Level Toggle */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Brain className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle className="text-base">Organization Memory Control</CardTitle>
                                <CardDescription className="text-sm mt-0.5">
                                    {orgMemoryEnabled
                                        ? "AI memory is enabled for all users in this organization."
                                        : "AI memory is disabled organization-wide. No users can create new memories."}
                                </CardDescription>
                            </div>
                        </div>
                        {canManage && (
                            <Switch
                                checked={orgMemoryEnabled}
                                onCheckedChange={handleOrgToggle}
                                disabled={togglingMemory || loadingToggle}
                            />
                        )}
                    </div>
                </CardHeader>
                {!orgMemoryEnabled && (
                    <CardContent className="pt-0">
                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-600 dark:text-red-400">
                            <strong>Warning:</strong> When disabled, no user in this organization can create new memories or enable their personal memory toggle.
                            Existing memories are preserved and remain accessible.
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Org Stats */}
            {orgStats && (
                <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Active Memories</span>
                            <p className="text-2xl font-bold mt-1">{orgStats.totalActive}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Pinned</span>
                            <p className="text-2xl font-bold mt-1">{orgStats.totalPinned}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/10">
                        <CardContent className="pt-4 pb-3 px-4">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Users</span>
                            <p className="text-2xl font-bold mt-1">{orgStats.uniqueUsers}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search all memories across users..."
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
                            {MEMORY_TYPE_OPTIONS.map(t => (
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
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={fetchMemories} className="h-9 w-9">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Memory List */}
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
                        <p className="text-muted-foreground font-medium">No memories found</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                            {orgMemoryEnabled
                                ? "No memories have been created by users in this organization yet."
                                : "Memory is disabled for this organization."}
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
                                    {/* User avatar */}
                                    <div className="shrink-0">
                                        {mem.user_profile_image ? (
                                            <div className="h-8 w-8 rounded-full overflow-hidden border">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={mem.user_profile_image} alt={mem.user_name || ''} className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium border border-primary/10 text-primary">
                                                {(mem.user_name || 'U').substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

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
                                                    <Button size="sm" variant="default" onClick={() => handleSave(mem.id)} className="gap-1 h-7 text-xs">
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
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-medium">
                                                {mem.memory_type}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground/60">by</span>
                                            <span className="text-[10px] font-medium text-foreground/80">
                                                {mem.user_name || 'Unnamed User'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/60">•</span>
                                            <span className="text-[10px] text-muted-foreground/60 capitalize">{mem.source}</span>
                                            <span className="text-[10px] text-muted-foreground/60">•</span>
                                            <span className="text-[10px] text-muted-foreground/60">
                                                {new Date(mem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            {mem.is_pinned && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                                                    <Pin className="h-2.5 w-2.5" /> Pinned
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Admin Actions */}
                                    {canManage && (
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePin(mem)}>
                                                {mem.is_pinned
                                                    ? <PinOff className="h-3.5 w-3.5 text-primary" />
                                                    : <Pin className="h-3.5 w-3.5" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                                onClick={() => { setEditingId(mem.id); setEditContent(mem.content) }}>
                                                <Edit3 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(mem.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        {total} memor{total === 1 ? 'y' : 'ies'} total
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
