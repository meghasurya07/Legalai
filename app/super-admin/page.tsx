"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Building2,
    Users,
    Server,
    Loader2,
    ShieldAlert,
    Lock,
    BarChart3,
    TrendingUp,
    ScrollText,
} from "lucide-react"
import dynamic from "next/dynamic"

// Lazy-loaded tab components (code-split for performance)
const OverviewTab = dynamic(() => import("./components/overview-tab"), { loading: () => <TabLoader /> })
const UsageTab = dynamic(() => import("./components/usage-tab"), { loading: () => <TabLoader /> })
const OrganizationsTab = dynamic(() => import("./components/organizations-tab"), { loading: () => <TabLoader /> })
const UsersTab = dynamic(() => import("./components/users-tab"), { loading: () => <TabLoader /> })
const AuditLogTab = dynamic(() => import("./components/audit-log-tab"), { loading: () => <TabLoader /> })
const SystemTab = dynamic(() => import("./components/system-tab"), { loading: () => <TabLoader /> })

function TabLoader() {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
}

// =====================================================================
// TABS
// =====================================================================

type TabKey = "overview" | "usage" | "organizations" | "users" | "audit_log" | "system"

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "usage", label: "Usage", icon: <TrendingUp className="h-4 w-4" /> },
    { key: "organizations", label: "Orgs", icon: <Building2 className="h-4 w-4" /> },
    { key: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { key: "audit_log", label: "Audit", icon: <ScrollText className="h-4 w-4" /> },
    { key: "system", label: "System", icon: <Server className="h-4 w-4" /> },
]

const TAB_COMPONENTS: Record<TabKey, React.ComponentType> = {
    overview: OverviewTab,
    usage: UsageTab,
    organizations: OrganizationsTab,
    users: UsersTab,
    audit_log: AuditLogTab,
    system: SystemTab,
}

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

    const ActiveTabComponent = TAB_COMPONENTS[activeTab]

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
            <div className="flex gap-1 p-1 mb-6 bg-muted/50 rounded-lg overflow-x-auto scrollbar-none shrink-0">
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
            <ActiveTabComponent />
        </div>
    )
}
