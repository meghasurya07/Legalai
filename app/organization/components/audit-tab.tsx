"use client"

import { useState, useEffect, useCallback } from "react"
import { useOrg } from "@/context/org-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    ScrollText,
    Key,
    Loader2,
    Search,
    Filter,
} from "lucide-react"
import type { Team, Invite, AuditEntry } from "../types"

// =====================================================================

export default function AuditTab() {
    const { members } = useOrg()
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const pageSize = 25

    // Filters
    const [actionFilter, setActionFilter] = useState('')
    const [userFilter, setUserFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [exporting, setExporting] = useState(false)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const fetchAudit = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('limit', String(pageSize))
            params.set('offset', String(page * pageSize))
            if (actionFilter) params.set('action', actionFilter)
            if (userFilter) params.set('userId', userFilter)
            if (dateFrom) params.set('from', dateFrom)
            if (dateTo) params.set('to', dateTo)
            if (debouncedSearch) params.set('search', debouncedSearch)

            const res = await fetch(`/api/org/audit-log?${params}`)
            const data = await res.json()
            if (data.success) {
                setEntries(data.data || [])
                setTotal(data.total || 0)
            }
        } catch {
        } finally {
            setLoading(false)
        }
    }, [page, actionFilter, userFilter, dateFrom, dateTo, debouncedSearch])

    useEffect(() => { fetchAudit() }, [fetchAudit])

    // Reset to first page when filters change
    useEffect(() => { setPage(0) }, [actionFilter, userFilter, dateFrom, dateTo, debouncedSearch])

    const handleExport = async () => {
        setExporting(true)
        try {
            const params = new URLSearchParams()
            if (actionFilter) params.set('action', actionFilter)
            if (userFilter) params.set('userId', userFilter)
            if (dateFrom) params.set('from', dateFrom)
            if (dateTo) params.set('to', dateTo)
            if (debouncedSearch) params.set('search', debouncedSearch)

            const res = await fetch(`/api/org/audit-log/export?${params}`)
            if (!res.ok) throw new Error('Export failed')

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success('Audit log exported')
        } catch {
            toast.error('Failed to export audit log')
        } finally {
            setExporting(false)
        }
    }

    const clearFilters = () => {
        setActionFilter('')
        setUserFilter('')
        setDateFrom('')
        setDateTo('')
        setSearchQuery('')
        setPage(0)
    }

    const hasFilters = actionFilter || userFilter || dateFrom || dateTo || debouncedSearch

    const totalPages = Math.ceil(total / pageSize)

    // Complete action label map
    const ACTION_LABELS: Record<string, string> = {
        "org.updated": "Updated organization",
        "member.invited": "Invited member",
        "member.joined": "Member joined",
        "member.role_changed": "Changed member role",
        "member.removed": "Removed member",
        "invite.created": "Created invitation",
        "invite.revoked": "Revoked invitation",
        "invite.accepted": "Accepted invitation",
        "team.created": "Created team",
        "team.updated": "Updated team",
        "team.deleted": "Deleted team",
        "team.member_added": "Added team member",
        "team.member_removed": "Removed team member",
        "project.created": "Created project",
        "project.deleted": "Deleted project",
        "sso.configured": "Configured SSO",
        "sso.disabled": "Disabled SSO",
        "byok.configured": "Configured API key (BYOK)",
        "byok.updated": "Updated API key (BYOK)",
        "byok.removed": "Removed API key (BYOK)",
        "ethical_wall.created": "Created ethical wall",
        "ethical_wall.updated": "Updated ethical wall",
        "ethical_wall.deleted": "Deleted ethical wall",
        "matter.created": "Created matter",
        "matter.updated": "Updated matter",
        "matter.archived": "Archived matter",
    }

    const getActionLabel = (action: string) => ACTION_LABELS[action] || action.replace(/[._]/g, ' ')

    // Action categories for filter dropdown
    const ACTION_CATEGORIES = [
        { value: '', label: 'All actions' },
        { value: 'org', label: 'Organization' },
        { value: 'member', label: 'Members' },
        { value: 'invite', label: 'Invitations' },
        { value: 'team', label: 'Teams' },
        { value: 'project', label: 'Projects' },
        { value: 'sso', label: 'SSO' },
        { value: 'byok', label: 'API Keys (BYOK)' },
        { value: 'ethical_wall', label: 'Ethical Walls' },
        { value: 'matter', label: 'Matters' },
    ]

    // Action badge color
    const getActionColor = (action: string) => {
        if (action.startsWith('ethical_wall')) return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950'
        if (action.startsWith('sso') || action.startsWith('byok')) return 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950'
        if (action.includes('delete') || action.includes('removed') || action.includes('revoked') || action.includes('disabled')) return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950'
        if (action.includes('created') || action.includes('joined') || action.includes('added') || action.includes('configured')) return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950'
        return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950'
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ScrollText className="h-5 w-5 text-primary" />
                                Audit Log
                            </CardTitle>
                            <CardDescription>
                                {total.toLocaleString()} recorded actions · Track every change for compliance and security reviews
                            </CardDescription>
                        </div>
                        <Button onClick={handleExport} variant="outline" size="sm" className="gap-1.5" disabled={exporting || total === 0}>
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters Row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Input
                                placeholder="Search actions, users, targets..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-3"
                            />
                        </div>
                        <Select value={actionFilter || '_all'} onValueChange={v => setActionFilter(v === '_all' ? '' : v)}>
                            <SelectTrigger className="w-[170px]">
                                <SelectValue placeholder="All actions" />
                            </SelectTrigger>
                            <SelectContent>
                                {ACTION_CATEGORIES.map(cat => (
                                    <SelectItem key={cat.value || '_all'} value={cat.value || '_all'}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={userFilter || '_all'} onValueChange={v => setUserFilter(v === '_all' ? '' : v)}>
                            <SelectTrigger className="w-[170px]">
                                <SelectValue placeholder="All users" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_all">All users</SelectItem>
                                {members.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                        {m.user_name || 'Unnamed User'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-[145px]"
                            title="From date"
                        />
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-[145px]"
                            title="To date"
                        />
                        {hasFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                                Clear
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="text-sm">{hasFilters ? 'No entries match your filters.' : 'No audit entries yet.'}</p>
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_auto] gap-4 px-4 py-3 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                <span>Timestamp</span>
                                <span>Action</span>
                                <span>User</span>
                                <span>Target</span>
                                <span className="w-8"></span>
                            </div>

                            {/* Table rows */}
                            <div className="divide-y">
                                {entries.map(entry => (
                                    <div key={entry.id}>
                                        <button
                                            className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_auto] gap-4 px-4 py-3 w-full text-left hover:bg-muted/40 transition-colors items-center"
                                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                                            title="Click to expand details"
                                        >
                                            <span className="text-sm text-muted-foreground tabular-nums">
                                                {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                {' '}
                                                <span className="text-xs">{new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </span>
                                            <span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getActionColor(entry.action)}`}>
                                                    {getActionLabel(entry.action)}
                                                </span>
                                            </span>
                                            <span className="flex items-center gap-2 min-w-0">
                                                {entry.actor_image ? (
                                                    <span className="h-6 w-6 rounded-full bg-muted shrink-0 overflow-hidden border">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={entry.actor_image} alt="" className="h-full w-full object-cover" />
                                                    </span>
                                                ) : (
                                                    <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 border border-primary/10 text-primary">
                                                        {entry.actor_name
                                                            ? entry.actor_name.substring(0, 2).toUpperCase()
                                                            : (entry.actor_name || 'S').substring(0, 2).toUpperCase()}
                                                    </span>
                                                )}
                                                <span className="text-sm truncate">{entry.actor_name || 'System'}</span>
                                            </span>
                                            <span className="text-sm text-muted-foreground truncate">
                                                {entry.target_entity || '—'}
                                            </span>
                                            <span className="w-8 flex justify-center">
                                                <svg className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === entry.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </span>
                                        </button>

                                        {/* Expanded detail */}
                                        {expandedId === entry.id && (
                                            <div className="px-4 py-3 bg-muted/20 border-t">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-1">Full Timestamp</p>
                                                        <p className="font-mono text-xs">{new Date(entry.created_at).toISOString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-1">Action Code</p>
                                                        <p className="font-mono text-xs">{entry.action}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-1">Actor ID</p>
                                                        <p className="font-mono text-xs break-all">{entry.actor_user_id}</p>
                                                    </div>
                                                    {entry.target_id && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground mb-1">Target ID</p>
                                                            <p className="font-mono text-xs break-all">{entry.target_id}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                                    <div className="mt-3">
                                                        <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                                                        <pre className="text-xs font-mono bg-muted/50 rounded-md p-2 overflow-x-auto max-h-32">
                                                            {JSON.stringify(entry.metadata, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>
                                            First
                                        </Button>
                                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                                            Previous
                                        </Button>
                                        <span className="px-3 text-sm text-muted-foreground">
                                            Page {page + 1} of {totalPages}
                                        </span>
                                        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                                            Next
                                        </Button>
                                        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                                            Last
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
