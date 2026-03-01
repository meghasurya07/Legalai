"use client"

import * as React from "react"
import { Paperclip, Globe, FileText, Wand2, UploadCloud, X, Cloud, Check, Sparkles, Brain, ScanSearch, Scale, Search, ShieldAlert, Table, ChevronDown, ChevronRight, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { FileIcon } from "@/components/ui/file-icon"
import { FilePreviewContent } from "@/components/ui/file-preview-content"
import { Attachment, Message } from "@/types"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ModeBadges } from "@/components/ui/mode-badges"
import { CitationsSidebar } from "@/components/citations-sidebar"
import { CopyButton } from "@/components/ui/copy-button"
import {
    ChatCitationSource,
    parseSources,
    stripSourcesBlock,
    escapeCitationMarkers,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
    getFaviconUrl,
} from "@/lib/citations"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Re-export types and utils for backwards compatibility (markdown-renderer.tsx imports from here)
export type { ChatCitationSource } from "@/lib/citations"
export { getCitationSourceDisplayName, isDocumentSource, getDocumentRoute, getFaviconUrl } from "@/lib/citations"

export function SourceFavicon({
    url,
    size,
    className,
}: {
    url: string
    size: number
    className?: string
}) {
    const [failed, setFailed] = React.useState(false)
    const isDocument = isDocumentSource(url)

    // If it's a project document, always use the FileText icon instead of fetching a favicon
    if (isDocument) {
        const sizeClasses: Record<number, string> = {
            14: "h-3.5 w-3.5",
            16: "h-4 w-4",
            20: "h-5 w-5",
            32: "h-8 w-8",
            64: "h-16 w-16"
        }
        const sizeClass = sizeClasses[size] || "h-5 w-5"
        return (
            <div className={`flex items-center justify-center bg-primary/5 rounded-sm overflow-hidden shrink-0 ${sizeClass} ${className || ""}`}>
                <FileText className="h-[75%] w-[75%] text-primary/70" />
            </div>
        )
    }

    const src = getFaviconUrl(url, size)

    // Map common sizes to Tailwind classes to avoid inline styles
    const sizeClasses: Record<number, string> = {
        14: "h-3.5 w-3.5",
        20: "h-5 w-5",
        32: "h-8 w-8",
        64: "h-16 w-16"
    }

    const sizeClass = sizeClasses[size] || `h-[${size}px] w-[${size}px]`
    const style = sizeClasses[size] ? undefined : { width: size, height: size }

    if (!src || failed) {
        return React.createElement('div', {
            className: `flex items-center justify-center bg-primary/5 shrink-0 ${sizeClass} ${className || ""}`,
            style: style,
            'aria-hidden': "true"
        }, React.createElement(FileText, { className: "h-full w-full p-0.5 text-primary/40" }))
    }

    return (
        <Image
            src={src}
            alt=""
            width={size}
            height={size}
            className={className}
            unoptimized // Using unoptimized because favicons come from diverse external domains
            onError={() => setFailed(true)}
        />
    )
}

export function CitationPill({
    citationNum,
    source,
}: {
    citationNum: string
    source?: ChatCitationSource
    onOpenCitations?: () => void
}) {
    const [faviconFailed, setFaviconFailed] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const pillRouter = useRouter()

    if (!source) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.75em] font-medium bg-muted text-muted-foreground mx-0.5">
                [{citationNum}]
            </span>
        )
    }

    const displayName = getCitationSourceDisplayName(source.url, source.title)
    const faviconUrl = getFaviconUrl(source.url)
    const isDocument = isDocumentSource(source.url)

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-full text-[13px] font-medium bg-muted/60 hover:bg-muted/80 text-foreground/80 hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-border/50 leading-none h-[22px]"
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (isDocument) {
                            const route = getDocumentRoute(source.url)
                            if (route) {
                                pillRouter.push(route)
                            }
                        } else {
                            window.open(source.url, '_blank', 'noopener,noreferrer')
                        }
                    }}
                    aria-label={`Citation ${citationNum}: ${source.title}`}
                >
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-sm shrink-0 relative">
                        {isDocument ? (
                            <FileText className="h-3 w-3 text-primary/70" />
                        ) : faviconUrl && !faviconFailed ? (
                            <Image
                                src={faviconUrl}
                                alt=""
                                width={14}
                                height={14}
                                className="h-3.5 w-3.5 rounded-sm object-contain"
                                unoptimized
                                onError={() => setFaviconFailed(true)}
                            />
                        ) : (
                            <FileText className="h-3 w-3 text-primary/40" />
                        )}
                    </span>
                    <span className="truncate max-w-[120px]">{displayName}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-3 shadow-xl rounded-xl bg-background border border-border"
                side="top"
                align="center"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
            >
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-full border border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                        {isDocument ? (
                            <FileText className="h-4 w-4 text-primary/70" />
                        ) : (
                            <SourceFavicon url={source.url} size={32} className="h-8 w-8 object-cover" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                            {isDocument ? 'Project Document' : displayName}
                        </div>
                        <h4 className="text-sm font-bold leading-tight line-clamp-2">
                            {source.title}
                        </h4>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 pt-0.5 leading-snug">
                            {source.snippet || (isDocument ? 'Document' : source.url)}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export type ActivityPhase =
    | 'research_planning'
    | 'source_collection'
    | 'searching_web'
    | 'reading_sources'
    | 'reading_extraction'
    | 'comparing'
    | 'synthesis'
    | 'synthesizing'
    | 'thinking'
    | 'drafting'
    | 'writing'
    | 'complete'
    | 'error'
    | null

export interface AIActivityTimelineProps {
    phase: ActivityPhase
    entries: { phase: string; detail: string; time: Date }[]
    completedPhases: string[]
    domains: string[]
    sourceCount: number
    isExpanded: boolean
    onToggleExpand: () => void
}

export function AIActivityTimeline({
    phase,
    entries,
    completedPhases,
    domains,
    sourceCount,
    isExpanded,
    onToggleExpand
}: AIActivityTimelineProps) {
    if (!phase || phase === 'complete') return null

    const isWriting = phase === 'writing' || phase === 'drafting'
    const isError = phase === 'error'

    const phaseLabels: Record<string, string> = {
        research_planning: 'Research Planning',
        source_collection: 'Source Collection',
        searching_web: 'Searching Web',
        reading_sources: 'Reading Sources',
        reading_extraction: 'Information Extraction',
        comparing: 'Data Synthesis',
        synthesis: 'Synthesizing',
        synthesizing: 'Synthesizing',
        thinking: 'Analyzing Problem',
        drafting: 'Formulating Response',
        writing: 'Writing',
        error: 'System Error'
    }

    const phaseIcons: Record<string, React.ReactNode> = {
        research_planning: <Search className="h-3.5 w-3.5" />,
        source_collection: <Globe className="h-3.5 w-3.5" />,
        searching_web: <Globe className="h-3.5 w-3.5" />,
        reading_sources: <FileText className="h-3.5 w-3.5" />,
        reading_extraction: <ScanSearch className="h-3.5 w-3.5" />,
        comparing: <Scale className="h-3.5 w-3.5" />,
        synthesis: <Wand2 className="h-3.5 w-3.5" />,
        synthesizing: <Wand2 className="h-3.5 w-3.5" />,
        thinking: <Brain className="h-3.5 w-3.5" />,
        drafting: <Sparkles className="h-3.5 w-3.5" />,
        writing: <Sparkles className="h-3.5 w-3.5" />,
        error: <ShieldAlert className="h-3.5 w-3.5" />
    }

    // Determine current "display title"
    const currentTitle = isWriting ? "Generating answer" : (phaseLabels[phase] || "Processing")

    return (
        <div className="flex gap-3 justify-start max-w-[90%] my-2 animate-in fade-in slide-in-from-left-2 duration-300">
            {/* Avatar for Activity */}
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border transition-colors ${isError ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                isWriting ? 'bg-primary/10 border-primary/20 text-primary' :
                    'bg-muted/50 border-border text-muted-foreground'
                }`}>
                {isWriting ? <Sparkles className="h-4 w-4" /> : isError ? <ShieldAlert className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-2">
                {/* Header / Primary Status */}
                {React.createElement('button', {
                    onClick: onToggleExpand,
                    className: "flex items-center gap-2 group text-left w-fit",
                    'aria-expanded': isExpanded
                }, (
                    <>
                        <span className={`text-sm font-semibold tracking-tight ${isError ? 'text-destructive' : 'text-foreground/90'}`}>
                            {currentTitle}
                            {!isWriting && !isError && <span className="activity-shimmer ml-1 group-hover:text-primary"></span>}
                        </span>

                        {sourceCount > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                                {sourceCount} {sourceCount === 1 ? 'Source' : 'Sources'}
                            </span>
                        )}

                        <div className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </div>
                    </>
                ))}

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="flex flex-col gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 animate-in zoom-in-98 duration-200 origin-top">
                        {/* Domain Badges */}
                        {domains.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pb-1">
                                {domains.map((domain, i) => (
                                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-background border border-border/60 rounded-lg text-[11px] font-medium text-foreground/70 shadow-sm">
                                        <SourceFavicon url={`https://${domain}`} size={14} className="rounded-sm opacity-80" />
                                        <span>{domain}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Phase Steps */}
                        <div className="space-y-2">
                            {/* Completed Phases */}
                            {completedPhases.map((cp, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-[12px] text-muted-foreground/60">
                                    <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/10">
                                        <Check className="h-3 w-3 text-green-600" />
                                    </div>
                                    <span className="font-medium text-foreground/40">{phaseLabels[cp] || cp.replace(/_/g, ' ')}</span>
                                </div>
                            ))}

                            {/* Current (Active) Phase */}
                            {!isWriting && !isError && (
                                <div className="flex items-center gap-2.5 text-[12px]">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 animate-pulse text-primary">
                                        {phaseIcons[phase] || <div className="h-1 w-1 bg-current rounded-full" />}
                                    </div>
                                    <span className="font-semibold text-foreground/80">{phaseLabels[phase] || phase.replace(/_/g, ' ')}</span>
                                    <span className="activity-shimmer-dots text-primary"></span>
                                </div>
                            )}

                            {/* Detail entries for the current phase */}
                            {entries.filter(e => e.phase === phase).slice(-1).map((entry, i) => (
                                <div key={i} className="pl-7 text-[12px] text-muted-foreground leading-relaxed animate-in fade-in duration-500">
                                    {entry.detail}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

interface ChatInterfaceProps {
    onMessageSent?: () => void
    mode?: "default" | "project"
    projectTitle?: string
    projectId?: string
    workflowId?: string
    conversationType?: 'assistant' | 'documents' | 'templates'
    initialConversationId?: string
}

// Map UI conversation types to database types
const DB_TYPE_MAP: Record<string, string> = {
    'documents': 'vault',
    'templates': 'workflow',
    'assistant': 'assistant',
}

const RandomGreeting = dynamic(() => import("@/components/random-greeting"), { ssr: false })

export function ChatInterface({ onMessageSent, mode = "default", projectTitle, projectId, workflowId, conversationType = 'assistant', initialConversationId }: ChatInterfaceProps) {



    const [inputValue, setInputValue] = React.useState("")
    const [isFileDialogOpen, setIsFileDialogOpen] = React.useState(false)
    const [uploadedFiles, setUploadedFiles] = React.useState<Attachment[]>([])
    const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)
    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [conversationId, setConversationId] = React.useState<string | null>(initialConversationId || null)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)
    const chatContainerRef = React.useRef<HTMLDivElement>(null)
    const isAtBottomRef = React.useRef(true)
    const [openCitationsIndex, setOpenCitationsIndex] = React.useState<number | null>(null)
    const [isCitationsSidebarOpen, setIsCitationsSidebarOpen] = React.useState(false)
    const abortControllerRef = React.useRef<AbortController | null>(null)

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setIsLoading(false)
        setActivityPhase(null)
    }

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Activity indicator state
    const [activityPhase, setActivityPhase] = React.useState<ActivityPhase>(null)
    const [activityEntries, setActivityEntries] = React.useState<{ phase: string; detail: string; time: Date }[]>([])
    const [completedPhases, setCompletedPhases] = React.useState<string[]>([])
    const [activityDomains, setActivityDomains] = React.useState<string[]>([])
    const [activitySourceCount, setActivitySourceCount] = React.useState(0)
    const [activityExpanded, setActivityExpanded] = React.useState(true)

    // Load existing conversation messages when initialConversationId is provided
    React.useEffect(() => {
        if (initialConversationId) {
            setConversationId(initialConversationId)
            const loadConversation = async () => {
                try {
                    const res = await fetch(`/api/chat/conversations/${initialConversationId}/messages`)
                    if (res.ok) {
                        const data = await res.json()
                        const loadedMessages = data.map((msg: { role: 'user' | 'assistant', content: string, attachments?: Attachment[] }) => ({
                            role: msg.role,
                            content: msg.content,
                            files: msg.attachments || []
                        }))
                        setMessages(loadedMessages)
                        // Scroll to bottom so old chats open at the end
                        setTimeout(() => {
                            if (chatContainerRef.current) {
                                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
                                isAtBottomRef.current = true
                            }
                        }, 100)
                    }
                } catch (error) {
                    console.error('Failed to load conversation:', error)
                }
            }
            loadConversation()
        } else {
            // Reset for new chat
            setConversationId(null)
            setMessages([])
        }
    }, [initialConversationId])

    // Scroll to bottom helper
    const scrollToBottom = React.useCallback((force = false, behavior: 'auto' | 'smooth' = 'smooth') => {
        if (chatContainerRef.current) {
            if (force || isAtBottomRef.current) {
                chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior
                })
            }
        }
    }, [])

    const handleScroll = () => {
        if (!chatContainerRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
        const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50
        isAtBottomRef.current = isBottom
    }


    // Advanced Query Modes
    const [isThinking, setIsThinking] = React.useState(false)
    const [isWebSearch, setIsWebSearch] = React.useState(false)
    const [isDeepResearch, setIsDeepResearch] = React.useState(false)


    // Query Mode State
    const queryMode = "ask"

    const handleSend = async () => {
        if ((!inputValue.trim() && uploadedFiles.length === 0) || isLoading) return

        const userMessage = inputValue.trim()
        // Capture files before clearing logic
        const currentFiles = [...uploadedFiles]
        setMessages(prev => [...prev, { role: 'user', content: userMessage || (currentFiles.length > 0 ? `Sent ${currentFiles.length} file(s)` : ""), files: currentFiles }])
        setInputValue("")

        // Force scroll to bottom when user sends message
        isAtBottomRef.current = true
        setTimeout(() => scrollToBottom(true), 10)

        // Keep files for display in this message context if needed, but for now we clear them as per original logic
        // capturing them before clearing

        setUploadedFiles([])

        setIsLoading(true)

        let currentConversationId = conversationId

        try {
            // Create conversation if this is the first message
            if (!currentConversationId) {
                const convResponse = await fetch('/api/chat/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: DB_TYPE_MAP[conversationType] || conversationType,
                        projectId: projectId || null,
                        workflowId: workflowId || null
                    })
                })
                if (convResponse.ok) {
                    const convData = await convResponse.json()
                    currentConversationId = convData.id
                    setConversationId(convData.id)

                    // Update URL to include new chatId without reloading
                    const newSearchParams = new URLSearchParams(searchParams.toString())
                    newSearchParams.set('chatId', convData.id)
                    router.replace(`${pathname}?${newSearchParams.toString()}`)
                }
            }

            // Persist user message to database
            if (currentConversationId) {
                await fetch(`/api/chat/conversations/${currentConversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: 'user',
                        content: userMessage || `Sent ${currentFiles.length} file(s)`,
                        attachments: currentFiles.map(f => ({ name: f.name, type: f.type }))
                    })
                })
            }

            // Process files for extraction
            const processedFiles = await Promise.all(currentFiles.map(async (file) => {
                // If it's a Drive file, we can't extract text yet as we don't have the file blob
                if (file.source === 'drive' || !file.file) {
                    return { name: file.name, type: file.type }
                }

                let content = ''
                try {
                    if (file.type === 'pdf' || file.type === 'docx') {
                        const formData = new FormData()
                        formData.append('file', file.file)
                        const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
                        if (res.ok) {
                            const data = await res.json()
                            content = data.text
                        }
                    } else if (file.type === 'text' || file.type === 'csv' || file.type === 'other') {
                        // Clientside extraction for text-based files
                        content = await file.file.text()
                    }
                } catch (e) {
                    console.error("Failed to extract text for chat", e)
                }

                return { name: file.name, type: file.type, content }
            }))

            // Stream response from API
            const controller = new AbortController()
            abortControllerRef.current = controller

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    message: userMessage,
                    files: processedFiles,
                    projectId,
                    conversationId: currentConversationId, // Pass conversationId for persistence
                    queryMode,
                    webSearch: isWebSearch,
                    thinking: isThinking,
                    deepResearch: isDeepResearch
                })
            })

            if (!response.ok) {
                const errData = await response.json()
                toast.error(errData.error || 'Failed to get response')
                return
            }

            // Reset activity state
            setActivityPhase(null)
            setActivityEntries([])
            setCompletedPhases([])
            setActivityDomains([])
            setActivitySourceCount(0)
            setActivityExpanded(true)

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let fullContent = ''
            let assistantMsgAdded = false
            let buffer = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const rawLines = buffer.split('\n')
                    buffer = rawLines.pop() || '' // keep incomplete line in buffer

                    let currentEvent = ''
                    for (const rawLine of rawLines) {
                        const line = rawLine.trim()

                        if (line.startsWith('event: ')) {
                            currentEvent = line.slice(7)
                            continue
                        }

                        if (line.startsWith('data: ')) {
                            const data = line.slice(6)

                            if (data === '[DONE]') {
                                setActivityPhase('complete')
                                break
                            }

                            try {
                                const parsed = JSON.parse(data)

                                if (currentEvent === 'phase') {
                                    // Handle phase events
                                    const { phase, status, detail } = parsed

                                    if (status === 'start') {
                                        setActivityPhase(prev => {
                                            if (prev && prev !== phase && prev !== 'writing' && prev !== 'complete') {
                                                setCompletedPhases(cp => cp.includes(prev) ? cp : [...cp, prev])
                                            }
                                            return phase as ActivityPhase
                                        })
                                        if (detail) {
                                            setActivityEntries(prev => [...prev, { phase, detail, time: new Date() }])
                                        }
                                        // Auto-collapse if drafting/writing starts
                                        if (phase === 'drafting' || phase === 'writing') {
                                            setActivityExpanded(false)
                                        }
                                    } else if (status === 'update' && detail) {
                                        setActivityEntries(prev => [...prev, { phase, detail, time: new Date() }])
                                        // Track domains from search results
                                        if (parsed.domains) {
                                            setActivityDomains(parsed.domains)
                                        }
                                        if (parsed.count) {
                                            setActivitySourceCount(parsed.count)
                                        }
                                    } else if (status === 'error') {
                                        setActivityPhase('error')
                                        if (detail) {
                                            setActivityEntries(prev => [...prev, { phase: 'error', detail, time: new Date() }])
                                        }
                                    }
                                    scrollToBottom(false, 'auto')
                                } else if (parsed.content) {
                                    // Handle text streaming
                                    if (!assistantMsgAdded) {
                                        setMessages(prev => [...prev, { role: 'assistant', content: '', isWebSearch }])
                                        assistantMsgAdded = true
                                        // Auto-collapse activity when answer starts
                                        setActivityExpanded(false)
                                    }
                                    fullContent += parsed.content
                                    setMessages(prev => {
                                        const updated = [...prev]
                                        updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent }
                                        return updated
                                    })
                                    scrollToBottom(false, 'auto')
                                }
                            } catch { /* skip malformed */ }

                            currentEvent = '' // reset after processing
                        }
                    }
                }
            }

            // Assistant message is now saved by the backend to ensure persistence even if client disconnects

            if (onMessageSent) onMessageSent()
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Fetch aborted')
            } else {
                toast.error('Failed to send message')
                console.error(error)
            }
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const incomingFiles = Array.from(files)
            const duplicates = incomingFiles.filter(f => uploadedFiles.some(existing => existing.name === f.name))

            if (duplicates.length > 0) {
                setIsDuplicateModalOpen(true)
            }

            const uniqueFiles = incomingFiles.filter(f => !uploadedFiles.some(existing => existing.name === f.name))

            if (uniqueFiles.length === 0) {
                setIsFileDialogOpen(false)
                return
            }

            const newAttachments: Attachment[] = uniqueFiles.map(f => {
                let type: Attachment['type'] = 'other'
                if (f.type.startsWith('image/')) type = 'image'
                else if (f.type === 'application/pdf') type = 'pdf'
                else if (f.name.endsWith('.docx') || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') type = 'docx'
                else if (f.name.endsWith('.csv') || f.type === 'text/csv') type = 'csv'
                else if (f.type.startsWith('text/') || f.name.endsWith('.txt') || f.name.endsWith('.md') || f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.js') || f.name.endsWith('.json')) type = 'text'

                return {
                    name: f.name,
                    url: URL.createObjectURL(f),
                    type,
                    source: 'upload',
                    file: f
                }
            })
            setUploadedFiles(prev => [...prev, ...newAttachments])
            toast.success(`Uploaded ${uniqueFiles.length} file(s)`)
            setIsFileDialogOpen(false)
        }
    }




    const removeFile = (fileName: string) => {
        setUploadedFiles(prev => prev.filter(f => f.name !== fileName))
    }

    const closeCitationsSidebar = () => {
        setIsCitationsSidebarOpen(false)
        setOpenCitationsIndex(null)
    }

    const openCitations = (index: number) => {
        setOpenCitationsIndex(index)
        setIsCitationsSidebarOpen(true)
    }

    const hasMessages = messages.length > 0

    return (
        <div className="flex h-full w-full bg-background relative overflow-hidden">
            <div className="flex flex-col flex-1 h-full min-w-0 bg-background relative overflow-hidden">
                <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-2 sm:p-3 md:p-4 relative">

                    {/* Preview Dialog */}
                    < Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)
                    }>
                        <DialogContent className="max-w-full sm:max-w-4xl w-[95vw] sm:w-full h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
                            <DialogHeader className="p-3 sm:p-4 border-b bg-muted/20">
                                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                                    {previewAttachment?.type === 'docx' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" /> :
                                        previewAttachment?.type === 'csv' ? <Table className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" /> :
                                            previewAttachment?.type === 'pdf' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" /> :
                                                previewAttachment?.type === 'image' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" /> :
                                                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
                                    <span className="truncate">{previewAttachment?.name}</span>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 min-h-0 bg-muted/10 relative overflow-auto">
                                {previewAttachment && <FilePreviewContent attachment={previewAttachment} />}
                            </div>
                        </DialogContent>
                    </Dialog >

                    {/* Landing Page Content - Only visible when no messages */}
                    {
                        !hasMessages && (
                            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 animate-in fade-in zoom-in-95 duration-700">
                                <div className="flex flex-col items-center max-w-2xl mx-auto space-y-6">
                                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-center text-foreground/90 tracking-tight leading-tight">
                                        {mode === "project" ? projectTitle : <RandomGreeting />}
                                    </h1>
                                </div>
                            </div>
                        )
                    }

                    {/* Chat Messages Area - Visible when messages exist */}
                    {
                        hasMessages && (
                            <div
                                ref={chatContainerRef}
                                onScroll={handleScroll}
                                className="flex-1 min-h-0 overflow-y-auto mb-4 space-y-6 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                            >
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end px-4 md:px-12' : 'justify-start px-2 md:px-8'}`}>
                                        {msg.role === 'assistant' && (
                                            <div className="h-8 w-8 rounded-full border border-border/40 bg-card shadow-sm flex items-center justify-center shrink-0">
                                                <Sparkles className="h-4 w-4 text-primary" />
                                            </div>
                                        )}
                                        <div className={`max-w-[85%] min-w-0 space-y-3 ${msg.role === 'user' ? 'bg-card border border-border/40 text-foreground px-5 py-3.5 rounded-2xl shadow-sm text-[15px]' : 'text-[15px] pt-1'}`}>
                                            {msg.files && msg.files.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {msg.files.map((file: Attachment, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-black/10 transition-colors ${msg.role === 'user' ? 'bg-white/10 border-white/20' : 'bg-muted border-border'}`}
                                                            onClick={() => setPreviewAttachment(file)}
                                                        >
                                                            {file.type === 'image' ? (
                                                                <div className="h-8 w-8 rounded overflow-hidden bg-white/20 flex-shrink-0 relative">
                                                                    {file.url ? (
                                                                        <Image
                                                                            src={file.url}
                                                                            alt={file.name || "Preview"}
                                                                            fill
                                                                            className="object-cover"
                                                                            unoptimized
                                                                        />
                                                                    ) : <FileText />}
                                                                </div>
                                                            ) : (
                                                                <FileText className="h-4 w-4" />
                                                            )}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs font-medium truncate max-w-[150px]">{file.name}</span>
                                                                <span className="text-[10px] opacity-70 uppercase">{file.type}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.role === 'user' ? (
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                                            ) : (() => {
                                                const sources = parseSources(msg.content)
                                                const displayContent = escapeCitationMarkers(stripSourcesBlock(msg.content))
                                                const sourcesMap = new Map(sources.map((src) => [src.num, src]))

                                                const processTextWithCitations = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
                                                    if (!text || typeof text !== 'string') return [text]
                                                    const citationRegex = /⟦CITE_(\d+)⟧/g
                                                    const matches = Array.from(text.matchAll(citationRegex))
                                                    if (matches.length === 0) return [text]

                                                    const parts: React.ReactNode[] = []
                                                    let lastIndex = 0
                                                    let keyCounter = 0

                                                    for (const match of matches) {
                                                        const matchIndex = match.index!
                                                        if (matchIndex > lastIndex) parts.push(text.slice(lastIndex, matchIndex))
                                                        parts.push(
                                                            <CitationPill
                                                                key={`${keyPrefix}-citation-${keyCounter++}-${matchIndex}`}
                                                                citationNum={match[1]}
                                                                source={sourcesMap.get(match[1])}
                                                                onOpenCitations={() => openCitations(i)}
                                                            />
                                                        )
                                                        lastIndex = matchIndex + match[0].length
                                                    }
                                                    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
                                                    return parts.length > 0 ? parts : [text]
                                                }

                                                const processNodeForCitations = (node: React.ReactNode, keyPrefix: string = '', depth: number = 0, isInCode: boolean = false): React.ReactNode => {
                                                    if (depth > 10) return node
                                                    if (typeof node === 'string') {
                                                        if (isInCode) return node
                                                        const processed = processTextWithCitations(node, keyPrefix)
                                                        if (processed.length === 1 && processed[0] === node) return node
                                                        return processed
                                                    }
                                                    if (React.isValidElement(node)) {
                                                        const el = node as React.ReactElement<{ className?: string; children?: React.ReactNode }>
                                                        if (el.type === CitationPill) return el
                                                        const nodeType = el.type
                                                        const className = typeof el.props?.className === "string" ? el.props.className : ""
                                                        const isCodeElement = typeof nodeType === 'string' && (nodeType === 'code' || nodeType === 'pre' || className.includes('prose-code') || className.includes('code') || className.includes('language-'))
                                                        if (isCodeElement) return el
                                                        return React.cloneElement(el, { key: el.key || `${keyPrefix}-${depth}` }, React.Children.map(el.props.children, (child, idx) => processNodeForCitations(child, `${keyPrefix}-${idx}`, depth + 1, isInCode || isCodeElement)))
                                                    }
                                                    if (Array.isArray(node)) return node.map((item, idx) => processNodeForCitations(item, `${keyPrefix}-${idx}`, depth, isInCode))
                                                    return node
                                                }

                                                const processCitations = (children: React.ReactNode, prefix: string) =>
                                                    React.Children.map(children, (child) => processNodeForCitations(child, `${prefix}-${i}`, 0))

                                                const markdownComponents: Record<string, React.ElementType> = {
                                                    text: ({ children }) => typeof children === 'string' ? <>{processTextWithCitations(children, `text-${i}`)}</> : <>{children}</>,
                                                    code: ({ children, ...props }) => <code {...props}>{children}</code>,
                                                    pre: ({ children, ...props }) => <pre {...props}>{children}</pre>,
                                                    p: ({ children, ...props }) => <p className="my-3 leading-7" {...props}>{processCitations(children, 'p')}</p>,
                                                    ul: ({ children, ...props }) => <ul className="list-disc pl-6 my-3 space-y-2" {...props}>{children}</ul>,
                                                    ol: ({ children, ...props }) => <ol className="list-decimal pl-6 my-3 space-y-2" {...props}>{children}</ol>,
                                                    li: ({ children, ...props }) => React.createElement('li', { className: "my-0 leading-7", ...props }, processCitations(children, 'li')),
                                                    strong: ({ children, ...props }) => <strong {...props}>{processCitations(children, 'strong')}</strong>,
                                                    em: ({ children, ...props }) => <em {...props}>{processCitations(children, 'em')}</em>,
                                                    blockquote: ({ children, ...props }) => <blockquote {...props}>{processCitations(children, 'blockquote')}</blockquote>,
                                                    h1: ({ children, ...props }) => <h1 {...props}>{processCitations(children, 'h1')}</h1>,
                                                    h2: ({ children, ...props }) => <h2 {...props}>{processCitations(children, 'h2')}</h2>,
                                                    h3: ({ children, ...props }) => <h3 {...props}>{processCitations(children, 'h3')}</h3>,
                                                    table: ({ children, ...props }) => (<div className="my-4 w-full overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm text-left relative" {...props}>{children}</table></div>),
                                                    thead: ({ children, ...props }) => <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground border-b border-border" {...props}>{children}</thead>,
                                                    tbody: ({ children, ...props }) => <tbody className="divide-y divide-border/50 bg-background" {...props}>{children}</tbody>,
                                                    tr: ({ children, ...props }) => <tr className="hover:bg-muted/20 transition-colors" {...props}>{children}</tr>,
                                                    th: ({ children, ...props }) => <th className="px-4 py-3 font-medium whitespace-nowrap" {...props}>{children}</th>,
                                                    td: ({ children, ...props }) => <td className="px-4 py-3 align-top leading-relaxed" {...props}>{processCitations(children, 'td')}</td>,
                                                }

                                                return (
                                                    <>
                                                        <div data-msg-index={i} className="prose prose-sm dark:prose-invert max-w-none break-words overflow-x-auto prose-p:my-3 prose-p:leading-7 prose-headings:mt-6 prose-headings:mb-3 prose-headings:font-semibold prose-h2:text-lg prose-h3:text-base prose-ul:my-3 prose-ul:space-y-1 prose-ol:my-3 prose-ol:space-y-1 prose-li:my-0 prose-li:leading-7 prose-pre:my-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-blockquote:my-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-a:text-primary prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{displayContent || ''}</ReactMarkdown>
                                                        </div>
                                                        {msg.content && (
                                                            <div className="flex items-center gap-1 mt-3 -ml-1 relative">
                                                                <CopyButton displayContent={displayContent} msgSelector={`[data-msg-index="${i}"]`} />
                                                                {sources.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openCitations(i)}
                                                                        className="cursor-pointer inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
                                                                    >
                                                                        <span className="flex items-center -space-x-2">
                                                                            {sources.slice(0, 3).map((src) => (
                                                                                <span
                                                                                    key={src.num}
                                                                                    className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-border bg-background"
                                                                                >
                                                                                    <SourceFavicon url={src.url} size={20} className="h-5 w-5 object-cover" />
                                                                                </span>
                                                                            ))}
                                                                        </span>
                                                                        <span className="font-medium">Sources</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                ))}
                                {/* ═══ ChatGPT-style Activity Indicator ═══ */}
                                {isLoading && activityPhase && (
                                    <AIActivityTimeline
                                        phase={activityPhase}
                                        entries={activityEntries}
                                        completedPhases={completedPhases}
                                        domains={activityDomains}
                                        sourceCount={activitySourceCount}
                                        isExpanded={activityExpanded}
                                        onToggleExpand={() => setActivityExpanded(!activityExpanded)}
                                    />
                                )}
                                {/* Fallback loading dots */}
                                {isLoading && !activityPhase && !messages.some(m => m.role === 'assistant' && m.content) && (
                                    <div className="flex gap-3 justify-start">
                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                                            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                        </div>
                                        <div className="flex items-center gap-1.5 pt-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0s]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )
                    }

                    <div className={`w-full z-20 pb-6 pt-2 px-2 md:px-8 bg-transparent ${!hasMessages ? "mt-4 max-w-4xl mx-auto" : "mt-auto max-w-5xl mx-auto"}`}>
                        <div className="relative rounded-[2rem] border border-border/60 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-border overflow-hidden">


                            {/* Mode Badges */}
                            {mode === "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="inline" />}
                            {mode !== "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="absolute" />}

                            {uploadedFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/5">
                                    {uploadedFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setPreviewAttachment(file)}
                                            className="relative group flex items-center gap-2.5 p-2 pr-3 rounded-xl border bg-background/50 hover:bg-background hover:border-primary/30 transition-all duration-200 min-w-[140px] max-w-[200px] cursor-pointer"
                                        >
                                            <div className="h-8 w-8 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center relative overflow-hidden">
                                                {file.type === 'image' && file.url ? (
                                                    <Image
                                                        src={file.url}
                                                        alt={file.name}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <FileIcon filename={file.name} className="h-5 w-5" />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-xs font-medium truncate leading-none mb-1">{file.name}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{file.type}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(file.name)}
                                                aria-label={`Remove ${file.name}`}
                                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Textarea
                                id="chat-input"
                                placeholder={isLoading ? "AI is thinking..." : "Ask Legal AI anything..."}
                                className={`${hasMessages ? "min-h-[44px]" : "min-h-[120px]"} max-h-[50vh] overflow-y-auto w-full resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 p-4 text-base ${(isThinking || isWebSearch || isDeepResearch) && mode !== "project" ? "pt-10" : ""}`}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                            />

                            <div className={`flex items-center justify-between p-3 ${hasMessages ? "" : "border-t"} bg-muted/20 rounded-b-xl`}>
                                <div className="flex items-center gap-1 md:gap-2">
                                    <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 px-2 md:px-3" id="files-button">
                                                <Paperclip className="h-4 w-4" />
                                                <span className="hidden md:inline">Files and sources</span>
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Upload Files</DialogTitle>
                                                <DialogDescription>
                                                    Drag and drop files here or click to browse.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="flex items-center justify-center w-full">
                                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                        <p className="text-xs text-muted-foreground">Any file size accepted</p>
                                                    </div>
                                                    <Input id="dropzone-file" type="file" multiple className="hidden" onChange={handleFileUpload} />
                                                </label>
                                            </div>
                                            <div className="mt-4 flex flex-col gap-2">
                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <span className="w-full border-t" />
                                                    </div>
                                                    <div className="relative flex justify-center text-xs uppercase">
                                                        <span className="bg-background px-2 text-muted-foreground">Or import from</span>
                                                    </div>
                                                </div>
                                                <Button variant="outline" className="w-full gap-2" onClick={() => toast.info("Google Drive integration coming soon!")}>
                                                    <Cloud className="h-4 w-4" />
                                                    Google Drive
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>


                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${isWebSearch ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "text-muted-foreground"}`} onClick={() => {
                                                    const newState = !isWebSearch
                                                    setIsWebSearch(newState)
                                                    if (newState) {
                                                        setIsThinking(false)
                                                        setIsDeepResearch(false)
                                                    }
                                                }}>
                                                    <Globe className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Web Search</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${isThinking ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20" : "text-muted-foreground"}`} onClick={() => {
                                                    const newState = !isThinking
                                                    setIsThinking(newState)
                                                    if (newState) {
                                                        setIsWebSearch(false)
                                                        setIsDeepResearch(false)
                                                    }
                                                }}>
                                                    <Brain className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Thinking (Reasoning)</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    id="deep-research-toggle"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 rounded-full ${isDeepResearch ? "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" : "text-muted-foreground"}`}
                                                    onClick={() => {
                                                        const newState = !isDeepResearch
                                                        setIsDeepResearch(newState)
                                                        if (newState) {
                                                            setIsWebSearch(false)
                                                            setIsThinking(false)
                                                        }
                                                    }}
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Deep Research</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        className={`gap-2 bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-50 px-3 md:px-4 transition-all`}
                                        onClick={isLoading ? handleStop : handleSend}
                                        disabled={!isLoading && (!inputValue.trim() && uploadedFiles.length === 0)}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Square className="h-3 w-3 fill-current" />
                                                <span>Stop</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="hidden sm:inline">Ask Legal AI</span>
                                                <span className="sm:hidden">Ask</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {
                        // Removed recommended workflows to maintain a clean, minimalist empty state
                    }
                </div>
            </div>
            {/* Citations Sidebar */}
            <CitationsSidebar
                isOpen={isCitationsSidebarOpen && openCitationsIndex !== null}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? parseSources(messages[openCitationsIndex].content) : []}
                onClose={closeCitationsSidebar}
            />
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </div >
    )
}