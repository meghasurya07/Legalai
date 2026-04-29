/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import * as React from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter, useParams, useSearchParams } from "next/navigation"
import { History, MessageSquare, Loader2, MoreVertical, Pencil, Trash2, Pin, PinOff, Check, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface RecentConversation {
    id: string
    title: string
    type: string
    pinned: boolean
    projectId?: string
    workflowId?: string
    updatedAt: string
}

export function AppHeader() {
    const pathname = usePathname()
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const [isOpen, setIsOpen] = React.useState(false)
    const [conversations, setConversations] = React.useState<RecentConversation[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [renamingId, setRenamingId] = React.useState<string | null>(null)
    const [editTitle, setEditTitle] = React.useState("")
    const [deleteTarget, setDeleteTarget] = React.useState<RecentConversation | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isActionLoading, setIsActionLoading] = React.useState(false)

    // Determine context from the current route
    const getContext = React.useCallback(() => {
        if (pathname?.startsWith('/documents/')) {
            const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id as string
            return { type: 'vault', projectId, label: 'this project' }
        }
        if (pathname?.startsWith('/templates/')) {
            const workflowId = Array.isArray(params?.id) ? params.id[0] : params?.id as string
            return { type: 'workflow', workflowId, label: 'this template' }
        }
        return { type: 'assistant', label: 'chat' }
    }, [pathname, params])

    // Fetch recent conversations when popover opens
    const handleOpen = async (open: boolean) => {
        setIsOpen(open)
        if (!open) return

        setIsLoading(true)
        setError(null)
        const ctx = getContext()

        try {
            const urlParams = new URLSearchParams({ limit: '5' })
            if (ctx.type) urlParams.set('type', ctx.type)
            if (ctx.projectId) urlParams.set('projectId', ctx.projectId)
            if (ctx.workflowId) urlParams.set('workflowId', ctx.workflowId)

            const res = await fetch(`/api/chat/conversations?${urlParams.toString()}`)
            if (!res.ok) {
                setError(`Failed to load (${res.status})`)
                return
            }
            const data = await res.json()

            if (Array.isArray(data)) {
                setConversations(data)
            }
        } catch (err) {
            setError('Failed to load conversations')
        } finally {
            setIsLoading(false)
        }
    }

    // Navigate to a conversation
    const navigateTo = (conv: RecentConversation) => {
        if (renamingId) return // Don't navigate while renaming
        setIsOpen(false)

        if (conv.type === 'vault' && conv.projectId) {
            router.push(`/documents/${conv.projectId}/chat/${conv.id}`)
        } else if (conv.type === 'workflow' && conv.workflowId) {
            router.push(`/templates/${conv.workflowId}/chat/${conv.id}`)
        } else {
            router.push(`/chat/${conv.id}`)
        }
    }

    const togglePin = async (e: React.MouseEvent, conv: RecentConversation) => {
        e.stopPropagation()
        setIsActionLoading(true)
        try {
            const res = await fetch(`/api/chat/conversations/${conv.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pinned: !conv.pinned })
            })

            if (!res.ok) throw new Error('Failed to toggle pin')

            setConversations(prev => prev.map(c =>
                c.id === conv.id ? { ...c, pinned: !c.pinned } : c
            ))
            toast.success(conv.pinned ? "Conversation unpinned" : "Conversation pinned")
        } catch (err) {
            toast.error("Failed to update pin status")
        } finally {
            setIsActionLoading(false)
        }
    }

    const openDeleteDialog = (e: React.MouseEvent, conv: RecentConversation) => {
        e.stopPropagation()
        setDeleteTarget(conv)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/chat/conversations/${deleteTarget.id}`, {
                method: 'DELETE'
            })

            if (!res.ok) throw new Error('Failed to delete')

            setConversations(prev => prev.filter(c => c.id !== deleteTarget.id))
            toast.success("Conversation deleted")

            // If the deleted conversation is the current one, redirect to a new chat
            const currentChatId = searchParams.get('chatId')
            if (currentChatId === deleteTarget.id) {
                router.push(pathname)
            }
        } catch (err) {
            toast.error("Failed to delete conversation")
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    const startRename = (e: React.MouseEvent, conv: RecentConversation) => {
        e.stopPropagation()
        setRenamingId(conv.id)
        setEditTitle(conv.title)
    }

    const saveRename = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!editTitle.trim()) return

        setIsActionLoading(true)
        try {
            const res = await fetch(`/api/chat/conversations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle.trim() })
            })

            if (!res.ok) throw new Error('Failed to rename')

            setConversations(prev => prev.map(c =>
                c.id === id ? { ...c, title: editTitle.trim() } : c
            ))
            setRenamingId(null)
            toast.success("Conversation renamed")
        } catch (err) {
            toast.error("Failed to rename conversation")
        } finally {
            setIsActionLoading(false)
        }
    }

    // Format relative time
    const formatTime = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        const days = Math.floor(hrs / 24)
        return `${days}d ago`
    }

    const ctx = getContext()

    // Hide Recents on listing/index pages where there's no active chat context
    const hideRecents = pathname === '/documents' || pathname === '/templates' || pathname === '/recent-chats' || pathname?.startsWith('/calendar')

    return (
        <>
            <div className="flex h-14 shrink-0 items-center gap-4 px-6 w-full justify-between bg-transparent relative z-10">
                <div className="flex items-center gap-2" id="sidebar-trigger">
                    <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                    {!hideRecents && (
                        <Popover open={isOpen} onOpenChange={handleOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground rounded-full px-3">
                                    <History className="h-4 w-4" />
                                    <span className="text-xs font-medium hidden sm:inline">Recents</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="end" sideOffset={8}>
                                <div className="px-4 py-3 border-b">
                                    <h4 className="text-sm font-semibold">Recent Conversations</h4>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">From {ctx.label}</p>
                                </div>

                                <div className="max-h-[300px] overflow-y-auto">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : error ? (
                                        <div className="text-center py-8 text-sm text-destructive">
                                            {error}
                                        </div>
                                    ) : conversations.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-muted-foreground">
                                            No recent conversations
                                        </div>
                                    ) : (
                                        <div className="py-1">
                                            {[...conversations].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1)).map((conv) => (
                                                <div
                                                    key={conv.id}
                                                    className={cn(
                                                        "group relative w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors cursor-pointer border-l-2",
                                                        conv.pinned ? "border-primary bg-primary/5" : "border-transparent"
                                                    )}
                                                    onClick={() => navigateTo(conv)}
                                                >
                                                    <div className="h-7 w-7 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                                                        {conv.pinned ? (
                                                            <Pin className="h-3.5 w-3.5 text-primary fill-primary" />
                                                        ) : (
                                                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {renamingId === conv.id ? (
                                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <Input
                                                                    value={editTitle}
                                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                                    disabled={isActionLoading}
                                                                    className="h-7 text-sm py-0 px-2 flex-1"
                                                                    autoFocus
                                                                />
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-green-500"
                                                                    onClick={(e) => saveRename(e, conv.id)}
                                                                    disabled={isActionLoading || !editTitle.trim()}
                                                                >
                                                                    {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-destructive"
                                                                    onClick={() => setRenamingId(null)}
                                                                    disabled={isActionLoading}
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                                                    {conv.title}
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground">{formatTime(conv.updatedAt)}</p>
                                                            </>
                                                        )}
                                                    </div>

                                                    {!renamingId && (
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 hover:bg-muted-foreground/10"
                                                                        disabled={isActionLoading}
                                                                    >
                                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-40">
                                                                    <DropdownMenuItem onClick={(e) => togglePin(e, conv)}>
                                                                        {conv.pinned ? (
                                                                            <>
                                                                                <PinOff className="h-4 w-4 mr-2" />
                                                                                <span>Unpin</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Pin className="h-4 w-4 mr-2" />
                                                                                <span>Pin</span>
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={(e) => startRename(e, conv)}>
                                                                        <Pencil className="h-4 w-4 mr-2" />
                                                                        <span>Rename</span>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive"
                                                                        onClick={(e) => openDeleteDialog(e, conv)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        <span>Delete</span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog - Portal to body */}
            {
                !!deleteTarget && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center">
                        {/* Overlay */}
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                            onClick={() => { if (!isDeleting) setDeleteTarget(null) }}
                        />
                        {/* Dialog */}
                        <div className="relative z-[101] w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold text-foreground">Delete conversation?</h2>
                                <p className="text-sm text-muted-foreground">
                                    This will permanently delete &quot;{deleteTarget?.title || 'New Conversation'}&quot; and all its messages. This action cannot be undone.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={isDeleting}
                                    className="rounded-lg"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                                >
                                    {isDeleting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...</>
                                    ) : (
                                        'Delete'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}
