"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { HistoryHeader } from "@/components/recent-chats/history-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, Folder, Workflow, Loader2, Trash2, Clock, ArrowRight, Sparkles, Pin, PinOff, Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"
import { useDocuments } from "@/context/vault-context"
import { Project } from "@/types"

interface Conversation {
    id: string
    title: string
    type: string
    pinned?: boolean
    projectId?: string
    workflowId?: string
    createdAt: string
    updatedAt: string
    preview?: string
    messageCount?: number
}

interface WorkflowDef {
    id: string
    title: string
}

type TabType = "all" | "assistant" | "vault" | "workflow"

export default function RecentChatsPage() {
    const router = useRouter()
    const { projects, decrementQueryCount } = useDocuments() // Use global vault context
    const [activeTab, setActiveTab] = React.useState<TabType>("all")
    const [conversations, setConversations] = React.useState<Conversation[]>([])
    // Removed local projects state
    const [workflows, setWorkflows] = React.useState<WorkflowDef[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    // Sub-filters
    const [selectedProject, setSelectedProject] = React.useState<string>("all")
    const [selectedWorkflow, setSelectedWorkflow] = React.useState<string>("all")

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = React.useState<Conversation | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    // Rename
    const [renamingId, setRenamingId] = React.useState<string | null>(null)
    const [renameValue, setRenameValue] = React.useState('')

    React.useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            try {
                const [convsRes, workflowsRes] = await Promise.all([
                    fetch('/api/chat/conversations?limit=100'),
                    // projects are fetched via context
                    fetch('/api/templates/list')
                ])

                if (convsRes.ok) {
                    setConversations(await convsRes.json())
                } else {
                    const errBody = await convsRes.text()
                    console.error('Failed to fetch conversations:', convsRes.status, errBody)
                    toast.error(`Failed to load conversations (${convsRes.status})`)
                }
                if (workflowsRes.ok) {
                    setWorkflows(await workflowsRes.json())
                } else {
                    console.error('Failed to fetch workflows:', workflowsRes.status)
                }
            } catch (error) {
                console.error('Failed to fetch recent chats data:', error)
                toast.error('Failed to load recent chats data')
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/chat/conversations/${deleteTarget.id}`, { method: 'DELETE' })
            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== deleteTarget.id))

                // Live update of query count if it's a vault project conversation
                if (deleteTarget.projectId) {
                    decrementQueryCount(deleteTarget.projectId)
                }

                toast.success('Conversation deleted')
            } else {
                toast.error('Failed to delete conversation')
            }
        } catch {
            toast.error('Failed to delete conversation')
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    const handlePin = async (conv: Conversation) => {
        const res = await fetch(`/api/chat/conversations/${conv.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: !conv.pinned })
        })
        if (res.ok) {
            setConversations(prev => {
                const updated = prev.map(c => c.id === conv.id ? { ...c, pinned: !c.pinned } : c)
                return updated.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1
                    if (!a.pinned && b.pinned) return 1
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                })
            })
            toast.success(conv.pinned ? 'Unpinned' : 'Pinned')
        }
    }

    const handleRename = async (conv: Conversation) => {
        const res = await fetch(`/api/chat/conversations/${conv.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: renameValue })
        })
        if (res.ok) {
            setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, title: renameValue } : c))
            toast.success('Renamed')
        }
        setRenamingId(null)
    }

    // Helper to check type across both old ('documents','templates') and new ('vault','workflow') names
    const isVaultType = (type: string) => type === 'vault' || type === 'documents'
    const isWorkflowType = (type: string) => type === 'workflow' || type === 'templates'

    // Filtered conversations
    const filteredConversations = React.useMemo(() => {
        let filtered = conversations
        if (activeTab === "assistant") {
            filtered = conversations.filter(c => c.type === 'assistant')
        } else if (activeTab === "vault") {
            filtered = conversations.filter(c => isVaultType(c.type))
            if (selectedProject !== "all") {
                filtered = filtered.filter(c => c.projectId === selectedProject)
            }
        } else if (activeTab === "workflow") {
            filtered = conversations.filter(c => isWorkflowType(c.type))
            if (selectedWorkflow !== "all") {
                filtered = filtered.filter(c => c.workflowId === selectedWorkflow)
            }
        }
        return filtered
    }, [conversations, activeTab, selectedProject, selectedWorkflow])

    const pinnedConvs = filteredConversations.filter(c => c.pinned)
    const unpinnedConvs = filteredConversations.filter(c => !c.pinned)

    const projectsWithConversations = React.useMemo(() => {
        const ids = new Set(conversations.filter(c => isVaultType(c.type)).map(c => c.projectId))
        return projects.filter((p: Project) => ids.has(p.id))
    }, [conversations, projects])

    const workflowsWithConversations = React.useMemo(() => {
        const ids = new Set(conversations.filter(c => isWorkflowType(c.type)).map(c => c.workflowId))
        return workflows.filter(w => ids.has(w.id))
    }, [conversations, workflows])

    // Stats
    const stats = React.useMemo(() => ({
        total: conversations.length,
        assistant: conversations.filter(c => c.type === 'assistant').length,
        vault: conversations.filter(c => isVaultType(c.type)).length,
        workflow: conversations.filter(c => isWorkflowType(c.type)).length,
    }), [conversations])

    const getTypeIcon = (type: string) => {
        if (type === 'assistant') return <Sparkles className="h-4 w-4" />
        if (isVaultType(type)) return <Folder className="h-4 w-4" />
        if (isWorkflowType(type)) return <Workflow className="h-4 w-4" />
        return <MessageSquare className="h-4 w-4" />
    }

    const getTypeBadge = (type: string) => {
        const variants: Record<string, string> = {
            assistant: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            vault: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            documents: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            workflow: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
            templates: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        }
        const labels: Record<string, string> = {
            assistant: 'Chat', vault: 'Documents', documents: 'Documents', workflow: 'Templates', templates: 'Templates'
        }
        return (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${variants[type] || ''}`}>
                {getTypeIcon(type)}
                {labels[type] || type}
            </span>
        )
    }

    const ConversationRow = ({ conv }: { conv: Conversation }) => {
        const project = projects.find((p: Project) => p.id === conv.projectId)
        const workflow = workflows.find(w => w.id === conv.workflowId)
        const isRenaming = renamingId === conv.id

        return (
            <div
                className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-muted/60 cursor-pointer transition-all duration-200 border border-transparent hover:border-border/50"
                onClick={() => {
                    if (isRenaming) return
                    if (conv.projectId) {
                        router.push(`/documents/${conv.projectId}?chatId=${conv.id}`)
                    } else if (conv.workflowId) {
                        router.push(`/templates/${conv.workflowId}?chatId=${conv.id}`)
                    } else {
                        router.push(`/chat/${conv.id}`)
                    }
                }}
            >
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${conv.type === 'assistant' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                    isVaultType(conv.type) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    }`}>
                    {getTypeIcon(conv.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                            <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.stopPropagation(); handleRename(conv) }
                                    if (e.key === 'Escape') setRenamingId(null)
                                }}
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); handleRename(conv) }}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); setRenamingId(null) }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate flex items-center gap-1.5">
                                    {conv.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                                    {conv.title || 'New Conversation'}
                                </span>
                                {activeTab === 'all' && getTypeBadge(conv.type)}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                {isVaultType(conv.type) && project && (
                                    <span className="text-xs text-muted-foreground truncate">{project.title}</span>
                                )}
                                {isWorkflowType(conv.type) && workflow && (
                                    <span className="text-xs text-muted-foreground truncate">{workflow.title}</span>
                                )}
                                {((isVaultType(conv.type) && project) || (isWorkflowType(conv.type) && workflow)) && (
                                    <span className="text-muted-foreground/40">•</span>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                                </span>
                                {conv.messageCount && conv.messageCount > 0 && (
                                    <>
                                        <span className="text-muted-foreground/40">•</span>
                                        <span className="text-xs text-muted-foreground">
                                            {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                                        </span>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Actions */}
                {!isRenaming && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title={conv.pinned ? 'Unpin' : 'Pin'}
                            onClick={(e) => { e.stopPropagation(); handlePin(conv) }}
                        >
                            {conv.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Rename"
                            onClick={(e) => {
                                e.stopPropagation()
                                setRenamingId(conv.id)
                                setRenameValue(conv.title || '')
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Open"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (conv.projectId) {
                                    router.push(`/documents/${conv.projectId}?chatId=${conv.id}`)
                                } else if (conv.workflowId) {
                                    router.push(`/templates/${conv.workflowId}?chatId=${conv.id}`)
                                } else {
                                    router.push(`/chat/${conv.id}`)
                                }
                            }}
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv) }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/30 border border-border/50">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
                <h3 className="font-semibold text-lg">No conversations yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                    Start chatting with the AI assistant to see your recent chats here.
                </p>
            </div>
        </div>
    )

    return (
        <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
            <HistoryHeader />

            <div className="flex-1 overflow-y-auto scrollbar-none sm:scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 space-y-8">
                    {/* Stats bar */}
                    {!isLoading && conversations.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total', value: stats.total, color: 'from-slate-500/10 to-transparent border-slate-500/20' },
                                { label: 'Assistant', value: stats.assistant, color: 'from-blue-500/10 to-transparent border-blue-500/20' },
                                { label: 'Documents', value: stats.vault, color: 'from-emerald-500/10 to-transparent border-emerald-500/20' },
                                { label: 'Templates', value: stats.workflow, color: 'from-purple-500/10 to-transparent border-purple-500/20' },
                            ].map((stat) => (
                                <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.color} border px-6 py-4 shadow-sm transition-all hover:shadow-md`}>
                                    <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Content Area */}
                    <div className="space-y-6">
                        {/* Tabs + Filters */}
                        <div className="space-y-4">
                            <Tabs value={activeTab} className="w-full" onValueChange={(v) => setActiveTab(v as TabType)}>
                                <TabsList className="grid w-full grid-cols-2 h-auto sm:grid-cols-4 sm:h-12 gap-1 bg-muted/20 p-1 rounded-xl border border-border/50">
                                    <TabsTrigger value="all" className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full">All</TabsTrigger>
                                    <TabsTrigger value="assistant" className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full">Assistant</TabsTrigger>
                                    <TabsTrigger value="vault" className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full">Documents</TabsTrigger>
                                    <TabsTrigger value="workflow" className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full">Templates</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="flex flex-wrap gap-4">
                                {activeTab === "vault" && projectsWithConversations.length > 0 && (
                                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                                        <SelectTrigger className="w-full sm:w-[240px] rounded-xl h-10 shadow-sm border-border/60 bg-muted/5">
                                            <SelectValue placeholder="Filter by project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Projects</SelectItem>
                                            {projectsWithConversations.map((p: Project) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Folder className="h-3.5 w-3.5" />
                                                        {p.title}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {activeTab === "workflow" && workflowsWithConversations.length > 0 && (
                                    <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
                                        <SelectTrigger className="w-full sm:w-[240px] rounded-xl h-10 shadow-sm border-border/60 bg-muted/5">
                                            <SelectValue placeholder="Filter by workflow" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Templates</SelectItem>
                                            {workflowsWithConversations.map(w => (
                                                <SelectItem key={w.id} value={w.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Workflow className="h-3.5 w-3.5" />
                                                        {w.title}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* Conversation list */}
                        <div className="pb-24">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-24">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
                                        <span className="text-sm text-muted-foreground/60">Loading recent chats...</span>
                                    </div>
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <EmptyState />
                            ) : (
                                <div className="space-y-1">
                                    {/* Pinned section */}
                                    {pinnedConvs.length > 0 && (
                                        <>
                                            <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                <Pin className="h-3 w-3" /> Pinned
                                            </div>
                                            {pinnedConvs.map(conv => (
                                                <ConversationRow key={conv.id} conv={conv} />
                                            ))}
                                            {unpinnedConvs.length > 0 && (
                                                <div className="px-4 py-4 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-4">
                                                    Recent
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {/* Unpinned section */}
                                    {unpinnedConvs.map(conv => (
                                        <ConversationRow key={conv.id} conv={conv} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog - Portal to body for proper centering */}
            {!!deleteTarget && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                        onClick={() => { if (!isDeleting) setDeleteTarget(null) }}
                    />
                    {/* Dialog */}
                    <div className="relative z-50 w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
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
        </div>
    )
}
