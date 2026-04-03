"use client"

import * as React from "react"

import { Paperclip, Globe, FileText, Wand2, UploadCloud, X, Cloud, Sparkles, Brain, ShieldAlert, Table, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
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
import { ModeBadges } from "@/components/ui/mode-badges"
import { CitationsSidebar } from "@/components/citations-sidebar"
import { ActivitySidebar } from "@/components/activity-sidebar"
import { CopyButton } from "@/components/ui/copy-button"
import { PdfCitationPanel } from "@/components/pdf-citation-panel"
import type { PdfCitationTarget } from "@/components/pdf-citation-panel"
import { ConfidenceBadge, ConfidenceLevel } from "@/components/ui/confidence-badge"
import { Switch } from "@/components/ui/switch"
import {
    ChatCitationSource,
    parseSources,
    stripSourcesBlock,
    escapeCitationMarkers,
    parseDocumentCitationUrl,
} from "@/lib/citations"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Sub-components extracted from this file
import { SourceFavicon } from "@/components/chat/source-favicon"
import { CitationPill } from "@/components/chat/citation-pill"
import type { ActivityPhase } from "@/components/chat/activity-timeline"

// Re-export types and utils for backwards compatibility (markdown-renderer.tsx imports from here)
export type { ChatCitationSource } from "@/lib/citations"
export { getCitationSourceDisplayName, isDocumentSource, getDocumentRoute, getFaviconUrl } from "@/lib/citations"
// Re-export sub-components for backwards compatibility
export { SourceFavicon } from "@/components/chat/source-favicon"
export { CitationPill } from "@/components/chat/citation-pill"
export { AIActivityTimeline } from "@/components/chat/activity-timeline"
export type { ActivityPhase, AIActivityTimelineProps } from "@/components/chat/activity-timeline"



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
    const [isImprovingPrompt, setIsImprovingPrompt] = React.useState(false)
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
    const [pdfViewerTarget, setPdfViewerTarget] = React.useState<PdfCitationTarget | null>(null)
    const abortControllerRef = React.useRef<AbortController | null>(null)

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setIsLoading(false)
        setActivityPhase(null)
    }




    // Activity indicator state
    const [activityPhase, setActivityPhase] = React.useState<ActivityPhase>(null)
    const [activityEntries, setActivityEntries] = React.useState<{ phase: string; detail: string; time: Date }[]>([])
    const [isActivitySidebarOpen, setIsActivitySidebarOpen] = React.useState(false)

    // Thinking duration tracking (ChatGPT-style "Thought for Xs")
    const thinkingStartRef = React.useRef<number | null>(null)
    const [thinkingDuration, setThinkingDuration] = React.useState<number | null>(null)

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


    const [isThinking, setIsThinking] = React.useState(false)
    const [isWebSearch, setIsWebSearch] = React.useState(false)
    const [isDeepResearch, setIsDeepResearch] = React.useState(false)
    const [isConfidenceMode, setIsConfidenceMode] = React.useState(false)


    // Query Mode State
    const queryMode = "ask"

    const handleImprovePrompt = async () => {
        if (!inputValue.trim() || isImprovingPrompt || isLoading) return
        
        setIsImprovingPrompt(true)
        const originalInput = inputValue
        setInputValue("") 

        try {
            const controller = new AbortController()
            const response = await fetch('/api/chat/improve-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ prompt: originalInput })
            })

            if (!response.ok) {
                toast.error("Failed to improve prompt")
                setInputValue(originalInput)
                return
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let newText = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value, { stream: true })
                    newText += chunk
                    setInputValue(newText)
                }
            }
        } catch (error) {
            toast.error("An error occurred while improving the prompt")
            setInputValue(originalInput)
        } finally {
            setIsImprovingPrompt(false)
        }
    }

    const handleSend = async () => {
        if ((!inputValue.trim() && uploadedFiles.length === 0) || isLoading) return

        const userMessage = inputValue.trim()
        // Capture files before clearing logic
        const currentFiles = [...uploadedFiles]
        setMessages(prev => [...prev, { role: 'user', content: userMessage || (currentFiles.length > 0 ? `Sent ${currentFiles.length} file(s)` : ""), files: currentFiles }])
        setInputValue("")

        // Scroll the user's message to the top of the viewport (ChatGPT-style)
        isAtBottomRef.current = true
        setTimeout(() => {
            if (chatContainerRef.current) {
                // Scroll so the last user message is at the top
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
            }
        }, 10)

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
                    let nextUrl = `/chat/${convData.id}`
                    if (conversationType === 'documents') {
                        nextUrl = `/documents/${projectId}/chat/${convData.id}`
                    } else if (conversationType === 'templates') {
                        nextUrl = `/templates/${workflowId}/chat/${convData.id}`
                    }
                    window.history.replaceState(null, '', nextUrl)
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

            // Process files for extraction and storage
            const processedFiles = await Promise.all(currentFiles.map(async (file) => {
                // If it's a Drive file, we can't extract text yet as we don't have the file blob
                if (file.source === 'drive' || !file.file) {
                    return { name: file.name, type: file.type }
                }

                try {
                    const formData = new FormData()
                    formData.append('file', file.file)
                    // Upload to ephemeral storage to get a real fileId for citations
                    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
                    if (res.ok) {
                        const data = await res.json()
                        return { 
                            id: data.id, 
                            name: file.name, 
                            type: file.type, 
                            content: data.content 
                        }
                    } else {
                        throw new Error('Upload failed')
                    }
                } catch (e) {
                    // Fallback to client-side text if upload fails for text files
                    let content = ''
                    if (file.type === 'text' || file.type === 'csv' || file.type === 'other') {
                        content = await file.file.text()
                    }
                    return { name: file.name, type: file.type, content }
                }
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
                    deepResearch: isDeepResearch,
                    confidenceMode: isConfidenceMode
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
            setIsActivitySidebarOpen(false)
            thinkingStartRef.current = null
            setThinkingDuration(null)

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
                                        // Track thinking start time
                                        if (phase === 'thinking' || phase === 'searching_web') {
                                            thinkingStartRef.current = Date.now()
                                            setThinkingDuration(null)
                                        }
                                        // Add an empty assistant message on first phase event
                                        // so the TaskActivityTimeline has an anchor to render
                                        if (!assistantMsgAdded) {
                                            setMessages(prev => [...prev, { role: 'assistant', content: '', isWebSearch }])
                                            assistantMsgAdded = true
                                        }
                                        setActivityPhase(phase as ActivityPhase)
                                        if (detail) {
                                            setActivityEntries(prev => [...prev, { phase, detail, time: new Date() }])
                                        }

                                    } else if (status === 'update' && detail) {
                                        setActivityEntries(prev => [...prev, { phase, detail, time: new Date() }])
                                    } else if (status === 'complete') {
                                        if (detail) {
                                            setActivityEntries(prev => [...prev, { phase, detail, time: new Date() }])
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
                                    }
                                    // Compute thinking duration on first text delta
                                    if (thinkingStartRef.current && !thinkingDuration) {
                                        const elapsed = Math.round((Date.now() - thinkingStartRef.current) / 1000)
                                        setThinkingDuration(elapsed > 0 ? elapsed : 1)
                                        thinkingStartRef.current = null
                                    }
                                    if (parsed.replace) {
                                        // Replace event: swap full content with citation-processed version
                                        fullContent = parsed.content
                                    } else {
                                        fullContent += parsed.content
                                    }
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
            } else {
                toast.error('Failed to send message')
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

    // ─── PDF Viewer helpers ──────────────────────────────────────
    const openPdfViewer = React.useCallback((source: ChatCitationSource, citationNum: string) => {
        const parsed = parseDocumentCitationUrl(source.url)
        if (!parsed) return

        // Extract page number from title (format: "filename — Page N — Section")
        const pageMatch = source.title.match(/Page\s+(\d+)/i)
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : null

        setPdfViewerTarget({
            fileId: parsed.fileId,
            fileName: source.title.split(' — ')[0] || source.title,
            fileUrl: null,
            snippet: source.snippet || '',
            pageNumber,
            chunkIndex: parsed.chunkIndex,
            citationNum,
        })

        // Close other sidebars
        setIsCitationsSidebarOpen(false)
        setIsActivitySidebarOpen(false)
    }, [])

    const closePdfViewer = React.useCallback(() => {
        setPdfViewerTarget(null)
    }, [])

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
                                className="flex-1 min-h-0 overflow-y-auto mb-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                            >
                                <div className="flex flex-col min-h-full"><div className="space-y-6 shrink-0">
                                    {messages.map((msg, i) => {
                                        const isLastMessage = i === messages.length - 1;

                                        return (
                                            <React.Fragment key={i}>
                                                {/* ChatGPT-style "Thinking" / "Thought for Xs" clickable header */}
                                                {msg.role === 'assistant' && (activityPhase || thinkingDuration) && isLastMessage && (
                                                    <div className="mb-1 px-2 md:px-8 ml-12">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsActivitySidebarOpen(prev => !prev)}
                                                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                                                        >
                                                            <span className="font-medium">
                                                                {thinkingDuration
                                                                    ? (isThinking ? `Thought for ${thinkingDuration}s` : `Searched for ${thinkingDuration}s`)
                                                                    : activityPhase === 'searching_web' ? 'Searching the web'
                                                                        : activityPhase === 'thinking' ? 'Thinking'
                                                                            : activityPhase === 'drafting' ? 'Writing'
                                                                                : 'Processing'
                                                                }
                                                            </span>
                                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                                            {!thinkingDuration && <span className="inline-block w-1 h-1 rounded-full bg-current animate-pulse" />}
                                                        </button>
                                                    </div>
                                                )}
                                                <div className={`flex gap-4 ${msg.role === 'user' ? 'justify-end px-4 md:px-12' : 'justify-start px-2 md:px-8'}`}>
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

                                                            const processConfidenceBadges = (nodes: React.ReactNode[], keyPrefix: string): React.ReactNode[] => {
                                                                const result: React.ReactNode[] = []
                                                                let keyCounter = 0
                                                                for (const node of nodes) {
                                                                    if (typeof node === 'string') {
                                                                        const confRegex = /\[CONF_(HIGH|MEDIUM|LOW)\]/g
                                                                        const matches = Array.from(node.matchAll(confRegex))
                                                                        if (matches.length === 0) {
                                                                            result.push(node)
                                                                            continue
                                                                        }
                                                                        let lastIndex = 0
                                                                        for (const match of matches) {
                                                                            const matchIndex = match.index!
                                                                            if (matchIndex > lastIndex) result.push(node.slice(lastIndex, matchIndex))
                                                                            result.push(<ConfidenceBadge key={`${keyPrefix}-conf-${keyCounter++}-${matchIndex}`} level={match[1] as ConfidenceLevel} />)
                                                                            lastIndex = matchIndex + match[0].length
                                                                        }
                                                                        if (lastIndex < node.length) result.push(node.slice(lastIndex))
                                                                    } else {
                                                                        result.push(node)
                                                                    }
                                                                }
                                                                return result
                                                            }

                                                            const processTextWithCitations = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
                                                                if (!text || typeof text !== 'string') return [text]
                                                                // Match groups of citations that are separated only by whitespace or commas, or are adjacent
                                                                const citationGroupRegex = /⟦CITE_\d+⟧(?:[\s,]*⟦CITE_\d+⟧)*/g
                                                                const matches = Array.from(text.matchAll(citationGroupRegex))
                                                                const parts: React.ReactNode[] = []
                                                                let lastIndex = 0
                                                                let groupCounter = 0

                                                                for (const match of matches) {
                                                                    const matchIndex = match.index!
                                                                    if (matchIndex > lastIndex) {
                                                                        const beforeText = text.slice(lastIndex, matchIndex)
                                                                        parts.push(...(processConfidenceBadges([beforeText], `${keyPrefix}-before-${groupCounter}`) as React.ReactNode[]))
                                                                    }
                                                                    
                                                                    const matchString = match[0]
                                                                    const numRegex = /⟦CITE_(\d+)⟧/g
                                                                    const nums = Array.from(matchString.matchAll(numRegex)).map(m => m[1])
                                                                    
                                                                    // Deduplicate citations by source title
                                                                    const uniqueSources = new Map<string, { num: string, source: ChatCitationSource | undefined }>()
                                                                    for (const num of nums) {
                                                                        const src = sourcesMap.get(num)
                                                                        // Merge identical documents in the same group
                                                                        const key = src?.title || `unknown-${num}`
                                                                        if (!uniqueSources.has(key)) {
                                                                            uniqueSources.set(key, { num, source: src })
                                                                        }
                                                                    }

                                                                    const pills = Array.from(uniqueSources.values()).map((item, idx) => (
                                                                        <CitationPill
                                                                            key={`${keyPrefix}-citation-${groupCounter}-${idx}`}
                                                                            citationNum={item.num}
                                                                            source={item.source}
                                                                            onOpenCitations={() => openCitations(i)}
                                                                            onViewPdf={openPdfViewer}
                                                                        />
                                                                    ))

                                                                    // Render grouped pills seamlessly without commas
                                                                    parts.push(
                                                                        <span key={`${keyPrefix}-group-${groupCounter++}`} className="inline-flex items-center flex-wrap gap-1 mx-0.5">
                                                                            {pills}
                                                                        </span>
                                                                    )
                                                                    
                                                                    lastIndex = matchIndex + matchString.length
                                                                }
                                                                if (lastIndex < text.length) {
                                                                    const afterText = text.slice(lastIndex)
                                                                    parts.push(...(processConfidenceBadges([afterText], `${keyPrefix}-after-${groupCounter}`) as React.ReactNode[]))
                                                                }
                                                                return processConfidenceBadges(parts.length > 0 ? parts : [text], keyPrefix)
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

                                            </React.Fragment>
                                        );
                                    })}
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

                                </div>
                                    {/* ChatGPT-style spacer: pushes content to top when loading.
                                  flex-grow fills remaining space, collapses as answer streams in. */}
                                    {isLoading && <div className="flex-1" />}
                                    <div ref={messagesEndRef} />
                                </div>
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
                                placeholder={isLoading ? "AI is thinking..." : isImprovingPrompt ? "Rewriting prompt..." : "Ask Wesley anything..."}
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
                                                        toast.info("🔬 Deep Research is coming soon!", {
                                                            description: "This feature is currently under development and will be available shortly.",
                                                        })
                                                    }}
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Deep Research</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border h-6">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            id="confidence-mode-toggle"
                                                            checked={isConfidenceMode}
                                                            onCheckedChange={setIsConfidenceMode}
                                                            className="data-[state=checked]:bg-amber-500 scale-90"
                                                        />
                                                        <label
                                                            htmlFor="confidence-mode-toggle"
                                                            className="text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                                                        >
                                                            Verification
                                                        </label>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[200px] text-center">Confidence Mode: Strictly verifies AI facts against your documents.</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 md:gap-2 text-foreground/80 hover:text-foreground transition-all px-3 md:px-4 bg-background hover:bg-muted disabled:opacity-50"
                                        onClick={handleImprovePrompt}
                                        disabled={isLoading || isImprovingPrompt || !inputValue.trim()}
                                    >
                                        <Wand2 className={`h-3 w-3 ${isImprovingPrompt ? "animate-pulse text-primary" : "text-primary"}`} />
                                        <span className="hidden sm:inline">{isImprovingPrompt ? "Improving..." : "Improve"}</span>
                                    </Button>
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
                                                <span className="hidden sm:inline">Ask Wesley</span>
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
            {/* Activity Sidebar */}
            <ActivitySidebar
                isOpen={isActivitySidebarOpen}
                duration={thinkingDuration}
                entries={activityEntries}
                sources={messages.length > 0 ? parseSources(messages[messages.length - 1].content) : []}
                isThinkingMode={isThinking}
                onClose={() => setIsActivitySidebarOpen(false)}
            />
            {/* Citations Sidebar */}
            <CitationsSidebar
                isOpen={isCitationsSidebarOpen && openCitationsIndex !== null && !isActivitySidebarOpen && !pdfViewerTarget}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? parseSources(messages[openCitationsIndex].content) : []}
                onClose={closeCitationsSidebar}
                onViewPdf={openPdfViewer}
            />
            {/* PDF Citation Panel */}
            <PdfCitationPanel
                target={pdfViewerTarget}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? parseSources(messages[openCitationsIndex].content) : (messages.length > 0 ? parseSources(messages[messages.length - 1].content) : [])}
                onClose={closePdfViewer}
                onCitationClick={(src) => openPdfViewer(src, src.num)}
            />
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </div >
    )
}