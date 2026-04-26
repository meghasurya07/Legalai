"use client"

import type { DeadlinePriority, DeadlineStatus } from "@/types"
import { cn } from "@/lib/utils"

interface DeadlineStatusBadgeProps {
    status: DeadlineStatus
    priority?: DeadlinePriority
    className?: string
}

const STATUS_CONFIG: Record<DeadlineStatus, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    missed: { label: "Missed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
}

const PRIORITY_DOT: Record<DeadlinePriority, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
}

export function DeadlineStatusBadge({ status, priority, className }: DeadlineStatusBadgeProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

    return (
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium", config.className, className)}>
            {priority && (
                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[priority])} />
            )}
            {config.label}
        </span>
    )
}
