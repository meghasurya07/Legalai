"use client"

import { useEffect, useState } from "react"
import { MessageSquare, FileText, Workflow, MoreHorizontal, Folder, Trash2, ExternalLink } from "lucide-react"
import { HistoryItem } from "@/context/history-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface HistoryCardProps {
    item: HistoryItem
}

export function HistoryCard({ item }: HistoryCardProps) {
    const Icon = item.type === "vault" ? Folder : item.type === "workflow" ? Workflow : MessageSquare

    // Type-specific styles
    const typeStyles = {
        assistant: "text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800",
        vault: "text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        workflow: "text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200 dark:border-purple-800"
    }

    const typeLabel = {
        assistant: "Assistant",
        vault: "Documents Project",
        workflow: "Workflow"
    }

    return (
        <div className="group relative">
            <Card className="hover:shadow-md transition-all duration-200 border-border/50 hover:border-border cursor-pointer overflow-hidden">
                <CardContent className="p-0">
                    <div className="flex items-start gap-4 p-4 sm:p-5">
                        <div className={cn("shrink-0 p-2.5 rounded-xl border flex items-center justify-center", typeStyles[item.type])}>
                            <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-base leading-none truncate group-hover:text-primary transition-colors">
                                    {item.title}
                                </h3>
                                <div className="flex items-center gap-2 shrink-0">
                                    <TimeDisplay date={item.date} />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 sm:mr-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Open
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 overflow-hidden">
                                <Badge variant="secondary" className="text-xs font-normal shrink-0 px-1.5 py-0 h-5">
                                    {typeLabel[item.type]}
                                </Badge>
                                {item.subtitle && (
                                    <>
                                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                                        <p className="text-sm text-muted-foreground truncate opacity-80">
                                            {item.subtitle}
                                        </p>
                                    </>
                                )}
                            </div>

                            <p className="text-sm text-foreground/70 line-clamp-2 mt-2 leading-relaxed">
                                {item.preview}
                            </p>

                            {/* Metadata Footer */}
                            {(item.meta?.fileCount || item.meta?.workflowId) && (
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-dashed">
                                    {item.meta.fileCount && (
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <FileText className="w-3.5 h-3.5 mr-1" />
                                            {item.meta.fileCount} files
                                        </div>
                                    )}
                                    {item.meta.workflowId && (
                                        <div className="flex items-center text-xs text-muted-foreground uppercase tracking-wider font-medium">
                                            <Workflow className="w-3.5 h-3.5 mr-1" />
                                            {item.meta.workflowId}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function TimeDisplay({ date }: { date: Date | number }) {
    const [, setTick] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setTick(t => t + 1)
        }, 30000)
        return () => clearInterval(timer)
    }, [])

    return (
        <span suppressHydrationWarning className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(date, { addSuffix: true })}
        </span>
    )
}
