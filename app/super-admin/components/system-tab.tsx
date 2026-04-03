/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Server, AlertTriangle, Database, Loader2 } from "lucide-react"
import type { ActivityEntry, SystemHealth } from "../types"

// =====================================================================
// SYSTEM TAB
// =====================================================================

export default function SystemTab() {
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
                        <Badge variant="outline" className="text-[10px] ml-1">{health.totalTables || health.tableSizes.length} tables</Badge>
                        <Badge variant="outline" className="text-[10px]">{(health.totalRows || 0).toLocaleString()} rows</Badge>
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
                                    <span className="text-xs font-medium">{String(job.job_type || job.type || "Unknown")}</span>
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


