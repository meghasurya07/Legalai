"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import type { Org, AnalyticsData } from "../types"
import { formatNumber, formatCurrency, ProgressBar } from "../utils"

// =====================================================================
// USAGE ANALYTICS TAB
// =====================================================================

export default function UsageTab() {
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

