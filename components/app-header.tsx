"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import * as React from "react"

export function AppHeader() {
    return (
        <div className="flex h-14 shrink-0 items-center gap-4 px-6 w-full justify-between bg-transparent relative z-10">
            <div className="flex items-center gap-2" id="sidebar-trigger">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors rounded-full" />
            </div>
            <div className="flex items-center gap-2">
            </div>
        </div>
    )
}
