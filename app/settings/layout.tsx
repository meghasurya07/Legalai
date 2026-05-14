"use client"

import { usePathname, useRouter } from "next/navigation"
import { Settings as SettingsIcon, Brain, User } from "lucide-react"
import { cn } from "@/lib/utils"

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()

    const tabs = [
        { label: "Profile", href: "/settings", icon: User, active: pathname === "/settings" },
        { label: "Memory", href: "/settings/memory", icon: Brain, active: pathname === "/settings/memory" },
    ]

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden">
            {/* Header + Tab Nav */}
            <div className="shrink-0 border-b bg-background">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 pt-4 md:pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <SettingsIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
                            <p className="text-sm text-muted-foreground">Manage your personal preferences and profile.</p>
                        </div>
                    </div>
                    <nav className="flex gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.href}
                                onClick={() => router.push(tab.href)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative",
                                    tab.active
                                        ? "text-foreground bg-background"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {tab.active && (
                                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    )
}
