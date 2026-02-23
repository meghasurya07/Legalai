"use client"

import { HistoryItem } from "@/context/history-context"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, MessageSquare, Folder, Library } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface HistoryCardProps {
    item: HistoryItem
    onDelete: (id: string) => void
    onClick?: (id: string) => void
}

const categoryConfig = {
    Assistant: {
        icon: MessageSquare,
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        hoverColor: "hover:bg-blue-500/20"
    },
    Vault: {
        icon: Folder,
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        hoverColor: "hover:bg-emerald-500/20"
    },
    Workflows: {
        icon: Library,
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        hoverColor: "hover:bg-purple-500/20"
    }
}

export function HistoryCard({ item, onDelete, onClick }: HistoryCardProps) {
    const config = categoryConfig[item.type as keyof typeof categoryConfig]
    const CategoryIcon = config.icon

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        onDelete(item.id)
    }

    return (
        <Card
            className={`group relative p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-border/50 ${config.hoverColor}`}
            onClick={() => onClick?.(item.id)}
        >
            {/* Category Badge */}
            <div className="flex items-center justify-between mb-3">
                <Badge
                    variant="outline"
                    className={`${config.color} font-medium flex items-center gap-1.5 px-2.5 py-0.5`}
                >
                    <CategoryIcon className="h-3 w-3" />
                    {item.type}
                </Badge>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDelete}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-base mb-2 line-clamp-2 text-foreground">
                {item.title}
            </h3>

            {/* Preview */}
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {item.preview}
            </p>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    {formatDistanceToNow(item.date, { addSuffix: true })}
                </span>
                {item.meta?.projectId && (
                    <Badge variant="secondary" className="text-xs">
                        {item.meta.projectId}
                    </Badge>
                )}
                {item.meta?.workflowId && (
                    <Badge variant="secondary" className="text-xs">
                        {item.meta.workflowId}
                    </Badge>
                )}
            </div>


        </Card>
    )
}
