"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    Brain,
    Search,
    RefreshCw,
    Shield,
    Filter,
    LayoutList,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Building2,
} from "lucide-react"
import Link from "next/link"
import MemoryHealth from "@/components/memory/memory-health"
import MemoryList from "@/components/memory/memory-list"
import AddMemoryModal from "@/components/memory/add-memory-modal"
import { type MemoryItem, MEMORY_TYPES } from "@/components/memory/memory-card"

// ─── Types ───────────────────────────────────────────────

interface MemoryStats {
    total: number
    active: number
    stale: number
    pinned: number
    by_type: Record<string, number>
    by_source: Record<string, number>
}

// ─── Main Page ───────────────────────────────────────────

export default function MemorySettingsPage() {
    const [memoryEnabled, setMemoryEnabled] = useState(true)
    const [orgDisabled, setOrgDisabled] = useState(false)
    const [memories, setMemories] = useState<MemoryItem[]>([])
    const [stats, setStats] = useState<MemoryStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState("all")
    const [sortBy, setSortBy] = useState("created_at")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [view, setView] = useState<'flat' | 'categorized'>('categorized')
    const [togglingMemory, setTogglingMemory] = useState(false)

    // Fetch toggle state (user + org)
    useEffect(() => {
        fetch('/api/memory/toggle')
            .then(r => r.json())
            .then(data => {
                setMemoryEnabled(data.enabled ?? true)
                setOrgDisabled(data.orgDisabled ?? false)
            })
            .catch(() => { /* default: enabled */ })
    }, [])

    // Toggle memory system (user-level)
    const handleToggle = async (enabled: boolean) => {
        if (orgDisabled) {
            toast.error("Memory has been disabled by your organization administrator.")
            return
        }
        setTogglingMemory(true)
        try {
            const res = await fetch('/api/memory/toggle', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            })
            const data = await res.json()
            if (data.success) {
                setMemoryEnabled(enabled)
                toast.success(data.message)
            } else {
                toast.error(data.error?.message || "Failed to update setting")
            }
        } catch {
            toast.error("Failed to update setting")
        } finally {
            setTogglingMemory(false)
        }
    }

    // Fetch user's memories (no projectId = user-level across all projects)
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
    }, [page, filterType, sortBy, search])

    // Fetch stats (user-level, no projectId)
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/memory/stats')
            const data = await res.json()
            setStats(data.stats || null)
        } catch {
            // Non-critical
        }
    }, [])

    useEffect(() => {
        fetchMemories()
        fetchStats()
    }, [fetchMemories, fetchStats])

    // Pin/unpin
    const togglePin = async (mem: MemoryItem) => {
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
    const deleteMemory = async (id: string) => {
        try {
            await fetch(`/api/memory/${id}`, { method: "DELETE" })
            setMemories(prev => prev.filter(m => m.id !== id))
            setTotal(prev => prev - 1)
            toast.success("Memory removed")
        } catch {
            toast.error("Failed to delete")
        }
    }

    // Save edit
    const saveEdit = async (id: string, content: string) => {
        try {
            const res = await fetch(`/api/memory/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            })
            const data = await res.json()
            if (data.memory) {
                setMemories(prev => prev.map(m => m.id === id ? { ...m, ...data.memory } : m))
                toast.success("Updated")
            }
        } catch {
            toast.error("Failed to update")
        }
    }

    // Confirm detected preference
    const confirmPreference = async (id: string) => {
        try {
            await fetch(`/api/memory/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    confidence: 1.0,
                    metadata: { user_confirmed: true, confirmed_at: new Date().toISOString() },
                }),
            })
            setMemories(prev => prev.map(m =>
                m.id === id ? { ...m, confidence: 1.0, metadata: { ...m.metadata, user_confirmed: true } } : m
            ))
            toast.success("Preference confirmed")
        } catch {
            toast.error("Failed to confirm")
        }
    }

    const refresh = () => {
        fetchMemories()
        fetchStats()
    }

    return (
        <div className="flex flex-col flex-1 w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6 space-y-6 h-full overflow-y-auto pb-20">
            {/* ─── Header ─── */}
            <div className="flex items-start justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Link href="/settings">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Brain className="h-6 w-6 text-primary" />
                            AI Memory
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage what Wesley remembers about your work, preferences, and cases.
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── Org Disabled Banner ─── */}
            {orgDisabled && (
                <Card className="border-red-500/20 bg-red-500/5 shrink-0">
                    <CardContent className="py-4 flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-red-500 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                Memory disabled by your organization
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Your firm administrator has disabled AI memory for the entire organization.
                                Contact your admin to re-enable this feature.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Global Toggle ─── */}
            <Card className="shrink-0">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <CardTitle className="text-base">Memory Persistence</CardTitle>
                                <CardDescription className="text-sm mt-0.5">
                                    When enabled, Wesley learns from your conversations and documents to provide better assistance over time.
                                </CardDescription>
                            </div>
                        </div>
                        <Switch
                            checked={memoryEnabled}
                            onCheckedChange={handleToggle}
                            disabled={togglingMemory || orgDisabled}
                        />
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                        <p>• Memories are stored securely within your organization&apos;s Supabase instance.</p>
                        <p>• Memories are never shared with AI model providers for training.</p>
                        <p>• You can view, edit, or delete any memory at any time.</p>
                        <p>• Disabling memory will not delete existing memories — it only stops new extraction.</p>
                    </div>
                </CardContent>
            </Card>

            {!memoryEnabled && !orgDisabled && (
                <Card className="border-amber-500/20 bg-amber-500/5 shrink-0">
                    <CardContent className="py-4 text-center text-sm text-amber-600">
                        Memory persistence is disabled. Wesley will not learn from new conversations.
                    </CardContent>
                </Card>
            )}

            {/* ─── Health Dashboard ─── */}
            <div className="space-y-3 shrink-0">
                <MemoryHealth stats={stats} onRefresh={refresh} />
            </div>

            <Separator className="shrink-0" />

            {/* ─── Controls ─── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search all memories..."
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

                    {/* View toggle */}
                    <div className="flex border rounded-md">
                        <Button
                            variant={view === 'flat' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-9 w-9 rounded-r-none"
                            onClick={() => setView('flat')}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={view === 'categorized' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-9 w-9 rounded-l-none"
                            onClick={() => setView('categorized')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button variant="ghost" size="icon" onClick={refresh} className="h-9 w-9">
                        <RefreshCw className="h-4 w-4" />
                    </Button>

                    <AddMemoryModal
                        onMemoryAdded={(mem) => {
                            setMemories(prev => [mem as unknown as MemoryItem, ...prev])
                            setTotal(prev => prev + 1)
                        }}
                    />
                </div>
            </div>

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
                            {memoryEnabled
                                ? "Memories are automatically extracted from your conversations and documents."
                                : "Enable memory persistence to start learning from your work."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <MemoryList
                    memories={memories}
                    onPin={togglePin}
                    onDelete={deleteMemory}
                    onSave={saveEdit}
                    onConfirmPreference={confirmPreference}
                    view={view}
                />
            )}

            {/* ─── Pagination ─── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 shrink-0">
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

            {/* ─── Privacy Footer ─── */}
            <Separator className="shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1 pb-8 shrink-0">
                <p className="font-medium">Data Privacy</p>
                <p>All memories are encrypted at rest (AES-256) and in transit (TLS 1.2+). Organization-level isolation ensures memories are never shared across tenants. You have full control to view, edit, and delete any memory in compliance with GDPR Article 17 (Right to Erasure).</p>
            </div>
        </div>
    )
}
