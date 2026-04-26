"use client"

import { format, parseISO } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, FolderOpen, Pencil, Trash2 } from "lucide-react"
import type { CalendarItem, DeadlineStatus, DeadlinePriority } from "@/types"
import { DeadlineStatusBadge } from "./deadline-status-badge"

interface EventDetailPopoverProps {
    item: CalendarItem | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit: (item: CalendarItem) => void
    onDelete: (item: CalendarItem) => void
    children?: React.ReactNode
}

export function EventDetailPopover({ item, open, onOpenChange, onEdit, onDelete, children }: EventDetailPopoverProps) {
    if (!item) return <>{children}</>

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                {children || <span />}
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start" sideOffset={4}>
                {/* Color header */}
                {/* noinspection CssInlineStyle */}
                <div className="h-2 rounded-t-lg" style={{ backgroundColor: item.color }} />

                <div className="p-4 space-y-3">
                    {/* Title + type */}
                    <div>
                        <h4 className="font-semibold text-foreground">{item.title}</h4>
                        {/* noinspection CssInlineStyle */}
                        <span
                            className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
                            style={{ backgroundColor: `${item.color}15`, color: item.color }}
                        >
                            {item.kind === "deadline" ? "⏰ " : ""}{item.type.replace(/_/g, " ")}
                        </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {item.allDay
                            ? format(parseISO(item.startAt), "EEEE, MMM d")
                            : `${format(parseISO(item.startAt), "MMM d, h:mm a")}${item.endAt ? ` – ${format(parseISO(item.endAt), "h:mm a")}` : ""}`
                        }
                    </div>

                    {/* Location */}
                    {item.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {item.location}
                        </div>
                    )}

                    {/* Project */}
                    {item.projectTitle && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FolderOpen className="h-3.5 w-3.5" />
                            {item.projectTitle}
                        </div>
                    )}

                    {/* Description */}
                    {item.description && (
                        <p className="text-sm text-muted-foreground border-t border-border/50 pt-2">
                            {item.description}
                        </p>
                    )}

                    {/* Deadline status */}
                    {item.kind === "deadline" && item.status && (
                        <div className="border-t border-border/50 pt-2">
                            <DeadlineStatusBadge status={item.status as DeadlineStatus} priority={item.priority as DeadlinePriority} />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 border-t border-border/50 pt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            onClick={() => { onEdit(item); onOpenChange(false) }}
                        >
                            <Pencil className="h-3 w-3" />
                            Edit
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                            onClick={() => { onDelete(item); onOpenChange(false) }}
                        >
                            <Trash2 className="h-3 w-3" />
                            Delete
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
