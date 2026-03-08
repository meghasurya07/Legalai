import { BookOpen, Folder, Lock, FileText, Database, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface ProjectCardProps {
    id: string
    title: string
    organization: string
    fileCount: number
    queryCount: number
    isSecured?: boolean
    icon?: "book" | "folder"
    onRename?: (id: string, currentTitle: string) => void
    onDelete?: (id: string, title: string) => void
}

export function ProjectCard({ id, title, organization, fileCount, queryCount, isSecured = false, icon = "folder", onRename, onDelete }: ProjectCardProps) {
    return (
        <div
            className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 h-[220px] transition-all hover:shadow-md cursor-pointer"
            onClick={() => toast.success(`Opening ${title}...`)}
        >
            {/* Top Right Secure Badge (Visible on Hover/Group Hover) */}
            {isSecured && (
                <div className="absolute top-4 right-4 opacity-0 transition-opacity group-hover:opacity-100 pr-8">
                    <Badge variant="secondary" className="gap-1 bg-black text-white hover:bg-black/90 text-[10px] h-6 px-2">
                        <Lock className="h-3 w-3" />
                        Secured by Wesley Documents
                    </Badge>
                </div>
            )}
            {isSecured && (
                <div className="absolute top-4 right-4 opacity-100 transition-opacity group-hover:opacity-0 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                </div>
            )}

            {/* Actions Menu */}
            <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onRename?.(id, title)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete?.(id, title)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Central Icon */}
            <div className="flex-1 flex items-center justify-center">
                <div className="h-16 w-16 text-muted-foreground/20">
                    {icon === "book" ? <BookOpen className="h-full w-full stroke-1" /> : <Folder className="h-full w-full stroke-1" />}
                </div>
            </div>

            {/* Content */}
            <div className="flex items-end justify-between">
                <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-sm leading-none">{title}</h3>
                    <p className="text-xs text-muted-foreground">{organization}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" /> {fileCount} files
                        </span>
                        <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" /> {queryCount} queries
                        </span>
                    </div>
                </div>
            </div>

        </div>
    )
}
