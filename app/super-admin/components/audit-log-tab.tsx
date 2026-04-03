"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2 } from "lucide-react"

// =====================================================================
// AUDIT LOG TAB
// =====================================================================

export default function AuditLogTab() {
    const [entries, setEntries] = useState<Array<{ id: string; source: string; action: string; actor: string; actor_name: string; target: string; details: Record<string, unknown>; created_at: string; org_id: string | null }>>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [sourceFilter, setSourceFilter] = useState("all")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    const fetchLogs = useCallback(async (p: number, s?: string, src?: string) => {
        setLoading(true)
        try {
            let url = `/api/super-admin/audit-log?page=${p}&limit=40`
            if (s) url += `&search=${encodeURIComponent(s)}`
            if (src && src !== 'all') url += `&source=${src}`
            const res = await fetch(url)
            const data = await res.json()
            if (data.success) {
                setEntries(data.data || [])
                setTotalPages(data.totalPages || 1)
            }
        } catch { /* */ } finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchLogs(1) }, [fetchLogs])

    const handleSearch = () => { setPage(1); fetchLogs(1, search, sourceFilter) }
    const handleSourceChange = (s: string) => { setSourceFilter(s); setPage(1); fetchLogs(1, search, s) }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h2 className="text-sm font-medium">Audit Log</h2>
                    <p className="text-xs text-muted-foreground">Combined audit trail from all sources</p>
                </div>
                <div className="flex items-center gap-2">
                    <select title="Filter by source" value={sourceFilter} onChange={e => handleSourceChange(e.target.value)} className="h-8 px-2 rounded-md border bg-background text-xs">
                        <option value="all">All sources</option>
                        <option value="audit">Audit log</option>
                        <option value="system">System log</option>
                    </select>
                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="Search actions…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} className="pl-8 h-8 text-xs" />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="space-y-1">
                    {entries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${entry.action.toLowerCase().includes("error") || entry.action.toLowerCase().includes("fail") ? "bg-red-500" : entry.source === "audit" ? "bg-blue-500" : "bg-emerald-500"}`} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{entry.action}</span>
                                    <Badge variant="outline" className="text-[9px]">{entry.source}</Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground">by {entry.actor_name}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                    {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No audit entries found.</p>}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchLogs(page - 1, search, sourceFilter) }} className="px-3 py-1.5 text-xs rounded-md border hover:bg-muted disabled:opacity-50">Previous</button>
                    <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchLogs(page + 1, search, sourceFilter) }} className="px-3 py-1.5 text-xs rounded-md border hover:bg-muted disabled:opacity-50">Next</button>
                </div>
            )}
        </div>
    )
}

