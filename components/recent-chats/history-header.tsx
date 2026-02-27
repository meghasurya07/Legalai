"use client"

import { History } from "lucide-react"

export function HistoryHeader() {
    return (
        <div className="flex flex-col gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6 sticky top-0 z-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <History className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Recent Chats</h1>
                        <p className="text-sm text-muted-foreground">View and manage your recent conversations</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
