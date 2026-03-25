"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Shield,
    Building2,
    Users,
    FolderOpen,
    MessageSquare,
    FileText,
    Activity,
    Server,
    Search,
    AlertTriangle,
    Database,
    Crown,
    Loader2,
    ShieldAlert,
    Lock,
    Zap,
    Hash,
    ArrowUpRight,
    BarChart3,
    Cpu,
    TrendingUp,
    Plus,
    Pencil,
    Globe,
} from "lucide-react"

// =====================================================================
// TYPES
// =====================================================================

interface Stats {
    organizations: number
    users: number
    projects: number
    conversations: number
    files: number
}

interface Org {
    id: string
    name: string
    slug: string
    status: string
    member_count: number
    licensed_seats: number
    sso_domain: string | null
    project_count: number
    created_at: string
}

interface PlatformUser {
    user_id: string
    role: string
    joined_at: string
    org_id: string
    org_name: string
    display_name: string
    display_image: string | null
}

interface ActivityEntry {
    id: string
    event_type: string
    project_id: string | null
    ref_id: string | null
    data: Record<string, unknown>
    created_at: string
    org_id: string | null
}

interface SystemHealth {
    recentErrors: { id: string; event_type: string; data: Record<string, unknown>; created_at: string }[]
    recentJobs: { id: string; type?: string; status?: string; created_at: string; [key: string]: unknown }[]
    tableSizes: { table: string; count: number }[]
}

interface AnalyticsData {
    totals: { calls: number; tokensIn: number; tokensOut: number; tokens: number; avgLatency: number; cost: number }
    perUser: { userId: string; name: string; calls: number; tokensIn: number; tokensOut: number; tokens: number; cost: number }[]
    perOrg: { orgId: string; name: string; calls: number; tokensIn: number; tokensOut: number; tokens: number; cost: number }[]
    perModel: { model: string; calls: number; tokens: number; cost: number }[]
    perUseCase: { useCase: string; calls: number; tokens: number; cost: number }[]
    daily: { date: string; calls: number; tokens: number; cost: number }[]
}

// =====================================================================
// HELPERS
// =====================================================================

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
    return n.toLocaleString()
}

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)
}

function ProgressBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    return (
        <div className={`h-2 rounded-full bg-muted overflow-hidden ${className}`}>
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
    )
}

// =====================================================================
// TABS
// =====================================================================

type TabKey = "overview" | "usage" | "organizations" | "users" | "system"

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "usage", label: "Usage Analytics", icon: <TrendingUp className="h-4 w-4" /> },
    { key: "organizations", label: "Organizations", icon: <Building2 className="h-4 w-4" /> },
    { key: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { key: "system", label: "System", icon: <Server className="h-4 w-4" /> },
]

// =====================================================================
// MAIN PAGE
// =====================================================================

export default function SuperAdminPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("overview")
    const [authorized, setAuthorized] = useState<boolean | null>(null)

    useEffect(() => {
        fetch("/api/super-admin/stats")
            .then(r => {
                setAuthorized(r.ok || r.status !== 403 ? r.ok : false)
            })
            .catch(() => setAuthorized(false))
    }, [])

    if (authorized === null) {
        return (
            <div className="flex flex-col flex-1 w-full justify-center items-center h-full gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Verifying access…</p>
            </div>
        )
    }

    if (!authorized) {
        return (
            <div className="flex flex-col flex-1 w-full justify-center items-center h-full gap-4">
                <div className="p-4 rounded-full bg-destructive/10">
                    <Lock className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground text-center max-w-md">
                    This area is restricted to platform administrators.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 pb-20 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/15 to-orange-500/15 border border-red-500/10">
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Platform Admin</h1>
                        <p className="text-xs text-muted-foreground">Wesley management console</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-xs gap-1 font-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    System Online
                </Badge>
            </div>

            <Separator className="mb-5 shrink-0" />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 mb-6 bg-muted/50 rounded-lg w-fit shrink-0">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.key
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "usage" && <UsageTab />}
            {activeTab === "organizations" && <OrganizationsTab />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "system" && <SystemTab />}
        </div>
    )
}

// =====================================================================
// OVERVIEW TAB
// =====================================================================

function OverviewTab() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [activity, setActivity] = useState<ActivityEntry[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAll = useCallback(() => {
        Promise.all([
            fetch("/api/super-admin/stats").then(r => r.json()),
            fetch("/api/super-admin/analytics").then(r => r.json()),
            fetch("/api/super-admin/activity").then(r => r.json()),
        ]).then(([statsRes, analyticsRes, activityRes]) => {
            if (statsRes.success) setStats(statsRes.data)
            if (analyticsRes.success) setAnalytics(analyticsRes.data)
            if (activityRes.success) setActivity(activityRes.data.slice(0, 8))
        }).finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        fetchAll()
        // Live auto-update every 15 seconds
        const intervalId = setInterval(fetchAll, 15000)
        return () => clearInterval(intervalId)
    }, [fetchAll])

    if (loading) {
        return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    }

    const platformCards = [
        { label: "Organizations", value: stats?.organizations || 0, icon: <Building2 className="h-4 w-4" />, color: "text-blue-600" },
        { label: "Users", value: stats?.users || 0, icon: <Users className="h-4 w-4" />, color: "text-emerald-600" },
        { label: "Projects", value: stats?.projects || 0, icon: <FolderOpen className="h-4 w-4" />, color: "text-violet-600" },
        { label: "Conversations", value: stats?.conversations || 0, icon: <MessageSquare className="h-4 w-4" />, color: "text-amber-600" },
        { label: "Files", value: stats?.files || 0, icon: <FileText className="h-4 w-4" />, color: "text-rose-600" },
    ]

    return (
        <div className="space-y-6">
            {/* Platform Stats: compact row */}
            <div className="grid grid-cols-5 gap-3">
                {platformCards.map(c => (
                    <Card key={c.label} className="border-0 bg-muted/30">
                        <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className={c.color}>{c.icon}</span>
                                <ArrowUpRight className="h-3 w-3 text-muted-foreground/50" />
                            </div>
                            <p className="text-xl font-semibold tracking-tight">{c.value}</p>
                            <p className="text-[11px] text-muted-foreground">{c.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Usage Summary Row */}
            {analytics && (
                <div className="grid grid-cols-4 gap-3">
                    <Card className="border-0 bg-gradient-to-br from-blue-500/5 to-blue-500/0">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-blue-600 mb-2">
                                <Zap className="h-4 w-4" />
                                <span className="text-xs font-medium">API Calls</span>
                            </div>
                            <p className="text-2xl font-semibold tracking-tight">{formatNumber(analytics.totals.calls)}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Total requests</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/0">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-emerald-600 mb-2">
                                <Hash className="h-4 w-4" />
                                <span className="text-xs font-medium">Total Tokens</span>
                            </div>
                            <p className="text-2xl font-semibold tracking-tight">{formatNumber(analytics.totals.tokens)}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatNumber(analytics.totals.tokensIn)} in · {formatNumber(analytics.totals.tokensOut)} out</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-violet-500/5 to-violet-500/0">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-violet-600 mb-2">
                                <Cpu className="h-4 w-4" />
                                <span className="text-xs font-medium">Avg Latency</span>
                            </div>
                            <p className="text-2xl font-semibold tracking-tight">{analytics.totals.avgLatency}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Per request</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-amber-600 mb-2">
                                <BarChart3 className="h-4 w-4" />
                                <span className="text-xs font-medium">Models</span>
                            </div>
                            <p className="text-2xl font-semibold tracking-tight">{analytics.perModel.length}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Active models</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Two-column: Activity + Model Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Activity */}
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0">
                        {activity.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>
                        ) : (
                            <div className="space-y-0.5">
                                {activity.map(entry => (
                                    <div key={entry.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/40 transition-colors">
                                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${entry.event_type.includes("ERROR") ? "bg-red-500" : "bg-emerald-500"
                                            }`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium truncate">{entry.event_type}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                            {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Model Usage */}
                {analytics && (
                    <Card className="border-0 bg-muted/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Model Usage</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {analytics.perModel.map(m => (
                                <div key={m.model} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium font-mono">{m.model}</span>
                                        <span className="text-[11px] text-muted-foreground">{m.calls} calls · {formatNumber(m.tokens)} tokens</span>
                                    </div>
                                    <ProgressBar value={m.tokens} max={analytics.totals.tokens} />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

// =====================================================================
// USAGE ANALYTICS TAB
// =====================================================================

function UsageTab() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchAnalytics = useCallback(() => {
        fetch("/api/super-admin/analytics")
            .then(r => r.json())
            .then(data => { if (data.success) setAnalytics(data.data) })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        fetchAnalytics()
        // Live auto-update every 15 seconds
        const intervalId = setInterval(fetchAnalytics, 15000)
        return () => clearInterval(intervalId)
    }, [fetchAnalytics])

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    if (!analytics) return <p className="text-sm text-muted-foreground text-center py-8">Failed to load analytics.</p>

    const maxUserTokens = analytics.perUser[0]?.tokens || 1
    const maxOrgTokens = analytics.perOrg[0]?.tokens || 1

    return (
        <div className="space-y-6">
            {/* Totals header */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="border-0 bg-muted/30">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold tracking-tight">{formatNumber(analytics.totals.calls)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total API Calls</p>
                    </CardContent>
                </Card>
                <Card className="border-0 bg-muted/30">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold tracking-tight">{formatNumber(analytics.totals.tokens)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total Tokens Used</p>
                    </CardContent>
                </Card>
                <Card className="border-0 bg-muted/30">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold tracking-tight">{analytics.totals.avgLatency}<span className="text-lg font-normal">ms</span></p>
                        <p className="text-xs text-muted-foreground mt-1">Avg Latency</p>
                    </CardContent>
                </Card>
                <Card className="border-0 bg-muted/30">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold tracking-tight">{formatCurrency(analytics.totals.cost)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total Spend</p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily activity mini chart */}
            {analytics.daily.length > 0 && (
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Daily API Calls</CardTitle>
                        <CardDescription className="text-xs">Last {analytics.daily.length} days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-1 h-24">
                            {analytics.daily.map(d => {
                                const maxCalls = Math.max(...analytics.daily.map(dd => dd.calls))
                                const h = maxCalls > 0 ? (d.calls / maxCalls) * 100 : 0
                                return (
                                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.date}: ${d.calls} calls, ${formatNumber(d.tokens)} tokens`}>
                                        <div className="w-full rounded-[2px] bg-primary opacity-60 transition-all group-hover:opacity-100" style={{ height: `${Math.max(h, 4)}%` }} />
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">{analytics.daily[0]?.date}</span>
                            <span className="text-[10px] text-muted-foreground">{analytics.daily[analytics.daily.length - 1]?.date}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Per-User and Per-Org */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Per User */}
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Usage by User</CardTitle>
                        <CardDescription className="text-xs">API calls and tokens per user</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {analytics.perUser.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No user data</p>
                        ) : analytics.perUser.map(u => (
                            <div key={u.userId} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium truncate max-w-[200px]">{u.name}</span>
                                    <span className="text-[11px] text-muted-foreground tabular-nums">{u.calls} calls · {formatNumber(u.tokens)} tokens · {formatCurrency(u.cost)}</span>
                                </div>
                                <ProgressBar value={u.tokens} max={maxUserTokens} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Per Org */}
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Usage by Organization</CardTitle>
                        <CardDescription className="text-xs">API calls and tokens per team</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {analytics.perOrg.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No organization data</p>
                        ) : analytics.perOrg.map(o => (
                            <div key={o.orgId} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium truncate max-w-[200px]">{o.name}</span>
                                    <span className="text-[11px] text-muted-foreground tabular-nums">{o.calls} calls · {formatNumber(o.tokens)} tokens · {formatCurrency(o.cost)}</span>
                                </div>
                                <ProgressBar value={o.tokens} max={maxOrgTokens} />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Per Use Case + Per Model */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Usage by Feature</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {analytics.perUseCase.map(uc => (
                                <div key={uc.useCase} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                                    <span className="text-xs font-mono">{uc.useCase}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-muted-foreground tabular-nums">{uc.calls} calls · {formatCurrency(uc.cost)}</span>
                                        <Badge variant="outline" className="text-[10px] font-mono">{formatNumber(uc.tokens)}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Usage by Model</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {analytics.perModel.map(m => (
                                <div key={m.model} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                                    <span className="text-xs font-mono">{m.model}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-muted-foreground tabular-nums">{m.calls} calls · {formatCurrency(m.cost)}</span>
                                        <Badge variant="outline" className="text-[10px] font-mono">{formatNumber(m.tokens)}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// =====================================================================
// ORGANIZATIONS TAB
// =====================================================================

function OrganizationsTab() {
    const [orgs, setOrgs] = useState<Org[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [showCreate, setShowCreate] = useState(false)
    const [editOrg, setEditOrg] = useState<Org | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state (shared by create + edit)
    const [formName, setFormName] = useState("")
    const [formSlug, setFormSlug] = useState("")
    const [formSeats, setFormSeats] = useState(10)
    const [formSsoDomain, setFormSsoDomain] = useState("")
    const [formStatus, setFormStatus] = useState("active")
    const [formOwnerEmail, setFormOwnerEmail] = useState("")
    const [formError, setFormError] = useState("")

    const fetchOrgs = useCallback(async (s?: string) => {
        setLoading(true)
        try {
            const url = s ? `/api/super-admin/organizations?search=${encodeURIComponent(s)}` : "/api/super-admin/organizations"
            const res = await fetch(url)
            const data = await res.json()
            if (data.success) setOrgs(data.data || [])
        } catch {
            console.error("Failed to fetch organizations")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchOrgs() }, [fetchOrgs])

    const handleSearch = () => fetchOrgs(search)

    const openCreate = () => {
        setFormName(""); setFormSlug(""); setFormSeats(10); setFormSsoDomain(""); setFormStatus("active"); setFormOwnerEmail(""); setFormError("")
        setShowCreate(true)
    }

    const openEdit = (org: Org) => {
        setFormName(org.name); setFormSlug(org.slug); setFormSeats(org.licensed_seats); setFormSsoDomain(org.sso_domain || ""); setFormStatus(org.status); setFormError("")
        setEditOrg(org)
    }

    const handleCreate = async () => {
        setSaving(true); setFormError("")
        try {
            const res = await fetch("/api/super-admin/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName, slug: formSlug, licensed_seats: formSeats, sso_domain: formSsoDomain || null, status: formStatus, owner_email: formOwnerEmail || null })
            })
            const data = await res.json()
            if (!data.success) { setFormError(data.error || "Failed to create"); return }
            if (data.ownerWarning) {
                setFormError(data.ownerWarning)
                // Still close after a delay so user can read the warning
                setTimeout(() => { setShowCreate(false); fetchOrgs() }, 3000)
                return
            }
            setShowCreate(false)
            fetchOrgs()
        } catch { setFormError("Network error") } finally { setSaving(false) }
    }

    const handleUpdate = async () => {
        if (!editOrg) return
        setSaving(true); setFormError("")
        try {
            const res = await fetch("/api/super-admin/organizations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editOrg.id, name: formName, licensed_seats: formSeats, sso_domain: formSsoDomain || null, status: formStatus })
            })
            const data = await res.json()
            if (!data.success) { setFormError(data.error || "Failed to update"); return }
            setEditOrg(null)
            fetchOrgs()
        } catch { setFormError("Network error") } finally { setSaving(false) }
    }

    // Shared modal form
    const renderModal = (title: string, onSave: () => void, onClose: () => void) => (
        typeof window !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200" onClick={() => { if (!saving) onClose() }} />
                <div className="relative z-[100] w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                    <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Organization Name</label>
                            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Pearson Hardman LLP" className="h-9 text-sm" />
                        </div>
                        {showCreate && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Slug</label>
                                <Input value={formSlug} onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="pearson-hardman" className="h-9 text-sm font-mono" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Licensed Seats</label>
                                <Input type="number" min={1} value={formSeats} onChange={e => setFormSeats(parseInt(e.target.value) || 1)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select title="Organization status" value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">SSO Domain <span className="text-muted-foreground/60">(optional)</span></label>
                            <Input value={formSsoDomain} onChange={e => setFormSsoDomain(e.target.value)} placeholder="pearsonhardman.com" className="h-9 text-sm" />
                        </div>
                        {showCreate && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Firm Admin Email <span className="text-muted-foreground/60">(owner)</span></label>
                                <Input type="email" value={formOwnerEmail} onChange={e => setFormOwnerEmail(e.target.value)} placeholder="admin@pearsonhardman.com" className="h-9 text-sm" />
                                <p className="text-[10px] text-muted-foreground">The user must have an Auth0 account. This org will appear in their dashboard.</p>
                            </div>
                        )}
                        {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors">Cancel</button>
                        <button onClick={onSave} disabled={saving || !formName.trim()} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {saving ? "Saving…" : showCreate ? "Create Organization" : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )
    )

    const seatPct = (m: number, s: number) => s > 0 ? Math.min((m / s) * 100, 100) : 0
    const seatColor = (m: number, s: number) => {
        const pct = seatPct(m, s)
        if (pct >= 90) return "bg-red-500"
        if (pct >= 70) return "bg-amber-500"
        return "bg-emerald-500"
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-medium">Organizations</h2>
                    <p className="text-xs text-muted-foreground">{orgs.length} registered</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> New Org
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Organization</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Slug</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Seats</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Projects</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">SSO Domain</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Created</th>
                                <th className="py-2.5 px-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {orgs.map(org => (
                                <tr key={org.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="py-2.5 px-3 font-medium">{org.name}</td>
                                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">{org.slug}</td>
                                    <td className="py-2.5 px-3">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[11px] font-medium tabular-nums">{org.member_count}/{org.licensed_seats}</span>
                                            <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-300 ${seatColor(org.member_count, org.licensed_seats)}`} style={{ width: `${seatPct(org.member_count, org.licensed_seats)}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-center tabular-nums">{org.project_count}</td>
                                    <td className="py-2.5 px-3">
                                        {org.sso_domain ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                                <Globe className="h-3 w-3" />{org.sso_domain}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/50">—</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        <Badge variant={org.status === "active" ? "default" : "destructive"} className="text-[10px]">{org.status}</Badge>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{new Date(org.created_at).toLocaleDateString()}</td>
                                    <td className="py-2.5 px-2">
                                        <button onClick={() => openEdit(org)} title="Edit organization" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {orgs.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No organizations found.</p>}
                </div>
            )}

            {showCreate && renderModal("Create Organization", handleCreate, () => setShowCreate(false))}
            {editOrg && renderModal(`Edit — ${editOrg.name}`, handleUpdate, () => setEditOrg(null))}
        </div>
    )
}

// =====================================================================
// USERS TAB
// =====================================================================

function UsersTab() {
    const [users, setUsers] = useState<PlatformUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    const [orgs, setOrgs] = useState<Org[]>([])

    // Create user form state
    const [formName, setFormName] = useState("")
    const [formEmail, setFormEmail] = useState("")
    const [formPassword, setFormPassword] = useState("")
    const [formOrgId, setFormOrgId] = useState("")
    const [formRole, setFormRole] = useState("member")
    const [formError, setFormError] = useState("")

    const fetchUsers = useCallback(async (s?: string) => {
        setLoading(true)
        try {
            const url = s ? `/api/super-admin/users?search=${encodeURIComponent(s)}` : "/api/super-admin/users"
            const res = await fetch(url)
            const data = await res.json()
            if (data.success) setUsers(data.data || [])
        } catch {
            console.error("Failed to fetch users")
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await fetch("/api/super-admin/organizations")
            const data = await res.json()
            if (data.success) setOrgs(data.data || [])
        } catch {
            console.error("Failed to fetch organizations")
        }
    }, [])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    const handleSearch = () => fetchUsers(search)

    const openCreate = () => {
        setFormName(""); setFormEmail(""); setFormPassword(""); setFormOrgId(""); setFormRole("member"); setFormError("")
        setShowCreate(true)
        fetchOrgs() // Load orgs for the dropdown
    }

    const handleCreate = async () => {
        setSaving(true); setFormError("")
        try {
            if (!formEmail.trim()) { setFormError("Email is required"); setSaving(false); return }
            if (!formPassword || formPassword.length < 8) { setFormError("Password must be at least 8 characters"); setSaving(false); return }

            const res = await fetch("/api/super-admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formEmail.trim(),
                    name: formName.trim() || undefined,
                    password: formPassword,
                    org_id: formOrgId || undefined,
                    role: formRole,
                })
            })
            const data = await res.json()
            if (!data.success) { setFormError(data.error || "Failed to create user"); return }
            setShowCreate(false)
            fetchUsers()
        } catch { setFormError("Network error") } finally { setSaving(false) }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-medium">Users</h2>
                    <p className="text-xs text-muted-foreground">{users.length} across all organizations</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> New User
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">User</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Organization</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Role</th>
                                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user, idx) => (
                                <tr key={`${user.user_id}-${idx}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                            {user.display_image ? (
                                                <div className="h-6 w-6 rounded-full overflow-hidden border shrink-0">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={user.display_image} alt="" className="h-full w-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 border">
                                                    {user.display_name.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium">{user.display_name}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-muted-foreground">{user.org_name}</td>
                                    <td className="py-2.5 px-3 text-center">
                                        <Badge variant={user.role === "owner" ? "default" : "outline"} className="text-[10px] gap-1">
                                            {user.role === "owner" && <Crown className="h-2.5 w-2.5" />}
                                            {user.role === "admin" && <Shield className="h-2.5 w-2.5" />}
                                            {user.role}
                                        </Badge>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{new Date(user.joined_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No users found.</p>}
                </div>
            )}

            {/* Create User Modal */}
            {showCreate && typeof window !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200" onClick={() => { if (!saving) setShowCreate(false) }} />
                    <div className="relative z-[100] w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Create User</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                                    <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Harvey Specter" className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Email <span className="text-red-500">*</span></label>
                                    <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="harvey@pearsonhardman.com" className="h-9 text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Password <span className="text-red-500">*</span></label>
                                <Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Min 8 characters" className="h-9 text-sm" />
                                <p className="text-[10px] text-muted-foreground">The user can change this later from their profile. Must be at least 8 characters.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Organization <span className="text-muted-foreground/60">(optional)</span></label>
                                    <select title="Select organization" value={formOrgId} onChange={e => setFormOrgId(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                                        <option value="">— No org —</option>
                                        {orgs.map(o => (
                                            <option key={o.id} value={o.id}>{o.name} ({o.member_count}/{o.licensed_seats})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Role</label>
                                    <select title="User role" value={formRole} onChange={e => setFormRole(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                </div>
                            </div>
                            {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowCreate(false)} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={saving || !formEmail.trim() || !formPassword} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {saving ? "Creating…" : "Create User"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

// =====================================================================
// SYSTEM TAB
// =====================================================================

function SystemTab() {
    const [health, setHealth] = useState<SystemHealth | null>(null)
    const [activity, setActivity] = useState<ActivityEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            fetch("/api/super-admin/system").then(r => r.json()),
            fetch("/api/super-admin/activity").then(r => r.json()),
        ]).then(([healthRes, activityRes]) => {
            if (healthRes.success) setHealth(healthRes.data)
            if (activityRes.success) setActivity(activityRes.data || [])
        }).finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

    return (
        <div className="space-y-6">
            {/* Database overview */}
            {health && (
                <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Database className="h-4 w-4" /> Database Tables
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {health.tableSizes.map(t => (
                            <div key={t.table} className="p-3 rounded-lg border bg-muted/20">
                                <p className="text-[11px] text-muted-foreground font-mono truncate">{t.table}</p>
                                <p className="text-lg font-semibold tabular-nums">{t.count.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Errors */}
            {health && (
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" /> Errors
                            <Badge variant="outline" className="ml-1 text-[10px]">{health.recentErrors.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {health.recentErrors.length === 0 ? (
                            <div className="py-4 text-center">
                                <p className="text-xs text-emerald-600 font-medium">✓ No recent errors</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {health.recentErrors.map(err => (
                                    <div key={err.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                        <span className="text-xs font-medium text-red-600 dark:text-red-400">{err.event_type}</span>
                                        <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(err.created_at).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* System Logs */}
            <Card className="border-0 bg-muted/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4" /> System Logs
                        <Badge variant="outline" className="ml-1 text-[10px]">{activity.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activity.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No system logs yet.</p>
                    ) : (
                        <div className="max-h-80 overflow-y-auto space-y-0.5 pr-1">
                            {activity.map(entry => (
                                <div key={entry.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/40 transition-colors">
                                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${entry.event_type.toLowerCase().includes("error") ? "bg-red-500" : "bg-emerald-500"}`} />
                                    <span className="text-xs font-medium flex-1 truncate">{entry.event_type}</span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                        {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Jobs */}
            {health && health.recentJobs.length > 0 && (
                <Card className="border-0 bg-muted/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Server className="h-4 w-4" /> Background Jobs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {health.recentJobs.map(job => (
                                <div key={job.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/40 transition-colors">
                                    <span className="text-xs font-medium">{job.type || "Unknown"}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(job.created_at).toLocaleString()}</span>
                                        <Badge variant={
                                            job.status === "completed" ? "default" :
                                                job.status === "failed" ? "destructive" : "outline"
                                        } className="text-[10px]">{job.status || "unknown"}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
