"use client"

import { Plus } from "lucide-react"

interface CreateProjectCardProps {
    onClick?: () => void
}

export function CreateProjectCard({ onClick }: CreateProjectCardProps) {
    return (
        <div
            id="new-project-btn"
            className="group flex flex-col justify-between rounded-xl border border-dashed bg-transparent p-6 h-[220px] cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={onClick}
        >
            <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                <Plus className="h-6 w-6" />
            </div>

            <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-sm">Create project</h3>
                <p className="text-xs text-muted-foreground">Upload a new collection of files</p>
            </div>
        </div>
    )
}
