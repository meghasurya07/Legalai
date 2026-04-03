"use client"

import { useState } from "react"
import { useOrg } from "@/context/org-context"
import { Separator } from "@/components/ui/separator"
import {
    Building2,
    Users,
    Shield,
    ScrollText,
    Key,
    ShieldAlert,
    Brain,
} from "lucide-react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Lazy-loaded tab components (code-split for performance)
function TabLoader() {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
}

const GeneralTab = dynamic(() => import("./components/general-tab"), { loading: () => <TabLoader /> })
const MembersTab = dynamic(() => import("./components/members-tab"), { loading: () => <TabLoader /> })
const SsoTab = dynamic(() => import("./components/sso-tab"), { loading: () => <TabLoader /> })
const ApiKeysTab = dynamic(() => import("./components/api-keys-tab"), { loading: () => <TabLoader /> })
const MemoryTab = dynamic(() => import("./components/memory-tab"), { loading: () => <TabLoader /> })
const EthicalWallsTab = dynamic(() => import("./components/ethical-walls-tab"), { loading: () => <TabLoader /> })
const AuditTab = dynamic(() => import("./components/audit-tab"), { loading: () => <TabLoader /> })

// =====================================================================
// TABS
// =====================================================================

type TabKey = "general" | "members" | "audit" | "sso" | "api_keys" | "ethical_walls" | "memory"

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <Building2 className="h-4 w-4" /> },
    { key: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
    { key: "memory", label: "Memory", icon: <Brain className="h-4 w-4" /> },
    { key: "sso", label: "Single Sign-On", icon: <Key className="h-4 w-4" /> },
    { key: "api_keys", label: "API Keys", icon: <Shield className="h-4 w-4" /> },
    { key: "ethical_walls", label: "Ethical Walls", icon: <ShieldAlert className="h-4 w-4" /> },
    { key: "audit", label: "Audit Log", icon: <ScrollText className="h-4 w-4" /> },
]

// =====================================================================
// MAIN PAGE
// =====================================================================

export default function OrganizationAdminPage() {
    const { org, members, role, isLoading, refreshOrg, refreshMembers } = useOrg()
    const [activeTab, setActiveTab] = useState<TabKey>("general")

    if (isLoading) {
        return (
            <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 justify-center items-center h-full">
                <p className="text-muted-foreground">Loading organization data…</p>
            </div>
        )
    }

    if (!org) {
        return (
            <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 justify-center items-center h-full">
                <p className="text-muted-foreground">No organization found. Please sign in.</p>
            </div>
        )
    }

    const canManage = role === "owner" || role === "admin"

    return (
        <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto p-3 sm:p-4 md:p-6 pb-20 overflow-y-auto">
            {/* Header */}
            <div className="space-y-2 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Organization</h1>
                        <p className="text-sm text-muted-foreground">Manage {org.name}</p>
                    </div>
                </div>
            </div>

            <Separator className="mb-6 shrink-0" />

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-none shrink-0 w-full">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "general" && <GeneralTab org={org} canManage={canManage} refreshOrg={refreshOrg} />}
            {activeTab === "members" && <MembersTab members={members} canManage={canManage} refreshMembers={refreshMembers} />}
            {activeTab === "sso" && <SsoTab canManage={canManage} />}
            {activeTab === "api_keys" && <ApiKeysTab canManage={canManage} />}
            {activeTab === "memory" && <MemoryTab canManage={canManage} />}
            {activeTab === "ethical_walls" && <EthicalWallsTab canManage={canManage} members={members} />}
            {activeTab === "audit" && <AuditTab />}
        </div>
    )
}
