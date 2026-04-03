"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Brain,
    Pin,
    TrendingUp,
    Archive,
    AlertTriangle,
    Trash2,

} from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "./memory-card"

// ─── Types ───────────────────────────────────────────────

interface MemoryStats {
    total: number
    active: number
    stale: number
    pinned: number
    by_type: Record<string, number>
    by_source: Record<string, number>
}

interface StaleMemory {
    id: string
    content: string
    memory_type: string
    decay_weight: number
    created_at: string
    last_accessed_at: string | null
}

// ─── Main Component ──────────────────────────────────────

interface MemoryHealthProps {
    stats: MemoryStats | null
    projectId?: string
    onRefresh?: () => void
}

export default function MemoryHealth({ stats, projectId, onRefresh }: MemoryHealthProps) {
    const [showStaleDialog, setShowStaleDialog] = useState(false)
    const [staleMemories, setStaleMemories] = useState<StaleMemory[]>([])
    const [loadingStale, setLoadingStale] = useState(false)
    const [archiving, setArchiving] = useState(false)

    if (!stats) return null

    const healthScore = stats.total > 0
        ? Math.round(((stats.active - stats.stale) / stats.total) * 100)
        : 100

    const healthColor = healthScore >= 80 ? 'text-emerald-500' : healthScore >= 50 ? 'text-amber-500' : 'text-red-500'
    const progressColor = healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'

    const loadStaleMemories = async () => {
        setLoadingStale(true)
        try {
            const params = new URLSearchParams({ stale: 'true', limit: '50' })
            if (projectId) params.set('projectId', projectId)
            const res = await fetch(`/api/memory?${params}`)
            const data = await res.json()
            setStaleMemories(data.memories || [])
        } catch {
            toast.error("Failed to load stale memories")
        } finally {
            setLoadingStale(false)
        }
    }

    const handleReviewStale = () => {
        setShowStaleDialog(true)
        loadStaleMemories()
    }

    const archiveAll = async () => {
        if (staleMemories.length === 0) return
        setArchiving(true)
        try {
            const ids = staleMemories.map(m => m.id)
            await Promise.all(
                ids.map(id =>
                    fetch(`/api/memory/${id}`, { method: "DELETE" })
                )
            )
            toast.success(`Archived ${ids.length} stale memories`)
            setStaleMemories([])
            setShowStaleDialog(false)
            onRefresh?.()
        } catch {
            toast.error("Failed to archive memories")
        } finally {
            setArchiving(false)
        }
    }

    const archiveSingle = async (id: string) => {
        try {
            await fetch(`/api/memory/${id}`, { method: "DELETE" })
            setStaleMemories(prev => prev.filter(m => m.id !== id))
            toast.success("Memory archived")
        } catch {
            toast.error("Failed to archive")
        }
    }

    return (
        <>
            {/* ─── Stats Grid ─── */}
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
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Types</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                            {Object.keys(stats.by_type).length}
                        </p>
                    </CardContent>
                </Card>
                <Card
                    className={`bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/10 ${
                        stats.stale > 0 ? 'cursor-pointer hover:border-red-500/30 transition-colors' : ''
                    }`}
                    onClick={stats.stale > 0 ? handleReviewStale : undefined}
                >
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center gap-2">
                            <Archive className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Stale</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{stats.stale}</p>
                        {stats.stale > 0 && (
                            <p className="text-[10px] text-red-500/70 mt-0.5">Click to review</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ─── Health Bar ─── */}
            <Card>
                <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Memory Health</span>
                            <span className={`text-sm font-bold ${healthColor}`}>{healthScore}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {stats.stale > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] gap-1 text-red-500 hover:text-red-600"
                                    onClick={handleReviewStale}
                                >
                                    <AlertTriangle className="h-3 w-3" />
                                    Review {stats.stale} stale
                                </Button>
                            )}
                        </div>
                    </div>
                    <Progress 
                        value={healthScore} 
                        className={`h-2 [&>[data-slot=progress-indicator]]:${progressColor}`} 
                    />
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                        <span>{stats.active} active</span>
                        <span>{stats.pinned} pinned</span>
                        <span>{stats.stale} stale</span>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Type Distribution ─── */}
            {Object.keys(stats.by_type).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.by_type)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                            <Badge key={type} variant="outline" className="text-[10px] py-0.5 px-2">
                                {type}: {count}
                            </Badge>
                        ))}
                </div>
            )}

            {/* ─── Stale Review Dialog ─── */}
            <Dialog open={showStaleDialog} onOpenChange={setShowStaleDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Stale Memories Review
                        </DialogTitle>
                    </DialogHeader>

                    <p className="text-sm text-muted-foreground">
                        These memories haven&apos;t been used recently and their relevance has decayed.
                        Archive them to keep your memory clean, or they&apos;ll be automatically deprioritized.
                    </p>

                    {loadingStale ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
                    ) : staleMemories.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No stale memories found. Everything is healthy! 🎉
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="gap-1"
                                    onClick={archiveAll}
                                    disabled={archiving}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {archiving ? "Archiving..." : `Archive All (${staleMemories.length})`}
                                </Button>
                            </div>

                            <div className="space-y-2 mt-2">
                                {staleMemories.map(mem => (
                                    <Card key={mem.id} className="border-red-500/10">
                                        <CardContent className="py-3 px-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm">{mem.content}</p>
                                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{mem.memory_type}</Badge>
                                                        <span>Decay: {Math.round(mem.decay_weight * 100)}%</span>
                                                        <span>•</span>
                                                        <span>Created {formatDate(mem.created_at)}</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={() => archiveSingle(mem.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
