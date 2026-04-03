/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, FolderOpen, MessageSquare, FileText, Activity, Loader2, Zap, Hash, ArrowUpRight, BarChart3, Cpu } from "lucide-react"
import type { Stats, Org, AnalyticsData, ActivityEntry } from "../types"
import { formatNumber, ProgressBar } from "../utils"

// =====================================================================
// OVERVIEW TAB
// =====================================================================

export default function OverviewTab() {
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

