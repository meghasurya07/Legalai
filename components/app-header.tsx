"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import * as React from "react"
import { usePathname, useRouter, useParams } from "next/navigation"
import { History, MessageSquare, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface RecentConversation {
    id: string
    title: string
    type: string
    projectId?: string
    workflowId?: string
    updatedAt: string
}

export function AppHeader() {
    const pathname = usePathname()
    const router = useRouter()
    const params = useParams()
    const [isOpen, setIsOpen] = React.useState(false)
    const [conversations, setConversations] = React.useState<RecentConversation[]>([])
    const [isLoading, setIsLoading] = React.useState(false)

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
        const ctx = getContext()

        try {
            const urlParams = new URLSearchParams({ limit: '5' })
            if (ctx.type) urlParams.set('type', ctx.type)
            if (ctx.projectId) urlParams.set('projectId', ctx.projectId)
            if (ctx.workflowId) urlParams.set('workflowId', ctx.workflowId)

            const res = await fetch(`/api/chat/conversations?${urlParams.toString()}`)
            const data = await res.json()

            if (Array.isArray(data)) {
                setConversations(data)
            }
        } catch (err) {
            console.error("Failed to fetch recent conversations", err)
        } finally {
            setIsLoading(false)
        }
    }

    // Navigate to a conversation
    const navigateTo = (conv: RecentConversation) => {
        setIsOpen(false)

        if (conv.type === 'vault' && conv.projectId) {
            router.push(`/documents/${conv.projectId}?chatId=${conv.id}`)
        } else if (conv.type === 'workflow' && conv.workflowId) {
            router.push(`/templates/${conv.workflowId}?chatId=${conv.id}`)
        } else {
            router.push(`/?chatId=${conv.id}`)
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
    const hideRecents = pathname === '/documents' || pathname === '/templates' || pathname === '/recent-chats'

    return (
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
                                ) : conversations.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        No recent conversations
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {conversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                type="button"
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => navigateTo(conv)}
                                            >
                                                <div className="h-7 w-7 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                                                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{conv.title}</p>
                                                    <p className="text-[11px] text-muted-foreground">{formatTime(conv.updatedAt)}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    )
}
