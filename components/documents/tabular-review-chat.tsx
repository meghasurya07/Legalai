/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { X, Send, Loader2, Sparkles, FileText, ExternalLink, Trash2 } from "lucide-react"
import { DocumentFile } from "@/types"
import type { ReviewColumn, ReviewCell } from "./tabular-review-view"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { ActivityPhase, ChatCitationSource, getCitationSourceDisplayName, isDocumentSource, getDocumentRoute, SourceFavicon } from "@/components/chat-interface"
import { TaskActivityTimeline } from "@/components/ui/task-activity-timeline"

interface TabularReviewChatProps {
    projectId: string
    projectTitle: string
    columns: ReviewColumn[]
    cells: Map<string, ReviewCell>
    documents: DocumentFile[]
    onClose: () => void
    initialMessages?: ChatMessage[]
    onSaveMessages?: (messages: ChatMessage[]) => void
}

interface ChatMessage {
    role: "user" | "assistant"
    content: string
}

export function TabularReviewChat({
    projectId,
    projectTitle,
    columns,
    cells,
    documents,
    onClose,
    initialMessages,
    onSaveMessages,
}: TabularReviewChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || [])
    const [input, setInput] = useState("")
    const [isStreaming, setIsStreaming] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const latestMessagesRef = useRef<ChatMessage[]>(messages)

    // Activity indicator state
    const [activityPhase, setActivityPhase] = useState<ActivityPhase>(null)
    const [activityEntries, setActivityEntries] = useState<{ phase: string; detail: string; time: Date }[]>([])
    const [completedPhases, setCompletedPhases] = useState<string[]>([])
    const [activityExpanded, setActivityExpanded] = useState(true)

    // Citations Sidebar state
    const [isCitationsSidebarOpen, setIsCitationsSidebarOpen] = useState(false)
    const [openCitationsIndex, setOpenCitationsIndex] = useState<number | null>(null)
    const [showClearConfirm, setShowClearConfirm] = useState(false)

    const openCitationsSidebar = (messageIndex: number) => {
        setOpenCitationsIndex(messageIndex)
        setIsCitationsSidebarOpen(true)
    }

    const closeCitationsSidebar = () => {
        setIsCitationsSidebarOpen(false)
        setOpenCitationsIndex(null)
    }

    const handleClearChat = () => {
        setMessages([]);
        if (onSaveMessages) {
            onSaveMessages([]);
        }
        setShowClearConfirm(false);
    }

    // Sync initialMessages when they load asynchronously from the DB
    useEffect(() => {
        if (initialMessages && initialMessages.length > 0) {
            setMessages(initialMessages)
        }
    }, [initialMessages])

    useEffect(() => {
        latestMessagesRef.current = messages
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Build context from tabular data for the AI
    const buildTabularContext = () => {
        const completedCells = Array.from(cells.entries())
            .filter(([, cell]) => cell.status === "completed")
            .map(([key, cell]) => {
                const [docId, colId] = key.split("__")
                const doc = documents.find(d => d.id === docId)
                const col = columns.find(c => c.id === colId)
                return { docName: doc?.name || "Unknown", colName: col?.name || "Unknown", content: cell.content }
            })

        if (completedCells.length === 0) return ""

        let context = `TABULAR REVIEW DATA (${documents.length} documents, ${columns.length} columns):\n\n`
        const docGroups = new Map<string, Array<{ colName: string; content: string }>>()

        for (const cell of completedCells) {
            if (!docGroups.has(cell.docName)) docGroups.set(cell.docName, [])
            docGroups.get(cell.docName)!.push({ colName: cell.colName, content: cell.content })
        }

        for (const [docName, cellData] of docGroups) {
            context += `--- ${docName} ---\n`
            for (const { colName, content } of cellData) {
                context += `  ${colName}: ${content}\n`
            }
            context += "\n"
        }

        return context
    }

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return

        const userMessage = input.trim()
        setInput("")
        setMessages(prev => [...prev, { role: "user", content: userMessage }])
        setIsStreaming(true)

        // Reset activity state for new message
        setActivityPhase(null)
        setActivityEntries([])
        setCompletedPhases([])
        setActivityExpanded(true)

        try {
            const tabularContext = buildTabularContext()

            // Set initial phase
            setActivityPhase('thinking')
            setActivityEntries([{ phase: 'thinking', detail: 'Analyzed query', time: new Date() }])

            // Simulate the inspection phase since it's local
            setTimeout(() => {
                setCompletedPhases(['thinking'])
                setActivityPhase('reading_extraction')
                setActivityEntries(prev => [...prev, { phase: 'reading_extraction', detail: 'Tabular review inspected', time: new Date() }])

                setTimeout(() => {
                    setCompletedPhases(prev => [...prev, 'reading_extraction'])
                    setActivityPhase('synthesis')
                    setActivityEntries(prev => [...prev, { phase: 'synthesis', detail: `Analyzed ${columns.length} columns by sorting table`, time: new Date() }])

                    setTimeout(() => {
                        setCompletedPhases(prev => [...prev, 'synthesis'])
                        setActivityPhase('drafting')
                        setActivityEntries(prev => [...prev, { phase: 'drafting', detail: 'Generating response...', time: new Date() }])
                    }, 800)
                }, 800)
            }, 500)

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    projectId,
                    customization: {
                        role: "Wesley Assistant — Tabular Review Mode",
                        instructions: `You are analyzing a tabular review of ${documents.length} documents in the project "${projectTitle}". The user has extracted structured data across ${columns.length} columns (${columns.map(c => c.name).join(", ")}). Use the tabular review data below as your primary context to answer questions. Be concise and cite specific documents when relevant.\n\n${tabularContext}`,
                    }
                })
            })

            if (!response.ok) throw new Error("Chat request failed")

            const reader = response.body?.getReader()
            if (!reader) throw new Error("No reader")

            const decoder = new TextDecoder()
            let assistantContent = ""

            setMessages(prev => [...prev, { role: "assistant", content: "" }])

            let firstTokenReceived = false

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value, { stream: true })
                const lines = text.split("\n")

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6)
                        if (data === "[DONE]") {
                            break
                        }

                        try {
                            const parsed = JSON.parse(data)



                            if (parsed.content) {
                                if (!firstTokenReceived) {
                                    firstTokenReceived = true
                                    // Ensure visual transition to 'writing' state
                                    setActivityPhase('writing')
                                }

                                assistantContent += parsed.content
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = {
                                        role: "assistant",
                                        content: assistantContent,
                                    }
                                    return updated
                                })
                            }
                        } catch {
                            // Skip non-JSON lines
                        }
                    }
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
            }])
        } finally {
            setIsStreaming(false)
            setActivityPhase('complete')
            setActivityExpanded(false)
            // Save messages after streaming completes, deferred to avoid setState in render warning
            setTimeout(() => {
                onSaveMessages?.(latestMessagesRef.current)
            }, 10)
        }
    }

    const completedCount = Array.from(cells.values()).filter(c => c.status === "completed").length
    const totalPossible = documents.length * columns.length

    return (
        <div className="flex flex-col h-full bg-background border-l shadow-xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Review Chat</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setShowClearConfirm(true)} className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors" title="Clear Chat">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Context indicator */}
            <div className="px-3 py-1.5 border-b bg-muted/30 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Context:</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                        {projectTitle}
                    </span>
                </div>
                {completedCount > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                        {completedCount}/{totalPossible} cells extracted
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center py-8 space-y-3">
                        <Sparkles className="h-8 w-8 mx-auto text-amber-500/50" />
                        <div>
                            <p className="text-sm font-medium">Analyze your tabular review</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Ask questions about the extracted data across your documents
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            {[
                                "What are the three most valuable contracts?",
                                "Compare the termination clauses across documents",
                                "Which agreements have the highest financial obligations?",
                            ].map(q => (
                                <button
                                    key={q}
                                    className="block w-full text-left text-[11px] px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground"
                                    onClick={() => {
                                        setInput(q)
                                        inputRef.current?.focus()
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {(() => {
                    let userCount = 0;
                    let startIndex = 0;
                    for (let i = messages.length - 1; i >= 0; i--) {
                        if (messages[i].role === "user") {
                            userCount++;
                            if (userCount === 20) {
                                startIndex = i;
                                break;
                            }
                        }
                    }
                    const visibleMessages = messages.slice(startIndex);

                    return visibleMessages.map((msg, idx) => {
                        const actualIndex = startIndex + idx;
                        const isLastMessage = actualIndex === messages.length - 1;
                        const isCurrentlyStreamingAssistant = isLastMessage && msg.role === "assistant" && activityPhase;

                        return (
                            <React.Fragment key={actualIndex}>
                                {isCurrentlyStreamingAssistant && activityExpanded && (
                                    <div className="mb-4">
                                        <TaskActivityTimeline
                                            phase={activityPhase}
                                            entries={activityEntries}
                                            completedPhases={completedPhases}
                                            onClose={() => setActivityExpanded(false)}
                                        />
                                    </div>
                                )}
                                <div className={msg.role === "user" ? "flex justify-end" : ""}>
                                    <div
                                        className={
                                            msg.role === "user"
                                                ? "bg-foreground text-background px-3 py-1.5 rounded-2xl rounded-br-sm text-[12px] max-w-[85%]"
                                                : "text-[12px] leading-relaxed"
                                        }
                                    >
                                        {msg.role === "assistant" ? (
                                            <>
                                                <MarkdownRenderer
                                                    content={msg.content}
                                                    onSourceClick={() => openCitationsSidebar(actualIndex)}
                                                />
                                                {isStreaming && actualIndex === messages.length - 1 && (
                                                    <span className="inline-block w-1.5 h-3.5 bg-foreground/60 ml-0.5 animate-pulse" />
                                                )}
                                            </>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                                {/* If the last message is from the user and we are waiting for the assistant, show timeline here */}
                                {isLastMessage && msg.role === "user" && activityPhase && activityExpanded && (
                                    <div className="mt-4 mb-4">
                                        <TaskActivityTimeline
                                            phase={activityPhase}
                                            entries={activityEntries}
                                            completedPhases={completedPhases}
                                            onClose={() => setActivityExpanded(false)}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    });
                })()}

                {/* AI Activity Timeline moved inside messages loop */}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t shrink-0">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
                        placeholder="Ask a follow up..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                        disabled={isStreaming}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className="h-7 w-7"
                    >
                        {isStreaming ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Citations Sidebar */}
            {isCitationsSidebarOpen && openCitationsIndex !== null && (() => {
                const msg = messages[openCitationsIndex]
                if (!msg) return null

                const sourcesMatch = msg.content.match(/<!--SOURCES:?\s*([\s\S]*?)(?:-->|$)/i)
                const sources: ChatCitationSource[] = sourcesMatch ? sourcesMatch[1].trim().split('\n').map((line: string) => {
                    const match = line.match(/\[(\d+)\]\s*([^|]+)(?:\s*\|\s*([^|]*?))?(?:\s*\|\s*(.*))?$/)
                    if (!match) return null

                    let url = (match[3] || '').trim()
                    if (url && !url.startsWith('http') && !url.includes('.')) url = ''

                    return {
                        num: match[1],
                        title: match[2].trim(),
                        url: url || 'https://legal-source.internal',
                        snippet: (match[4] || '').trim()
                    } as ChatCitationSource
                }).filter((x): x is ChatCitationSource => x !== null) : []

                return (
                    <div className="absolute inset-y-0 right-0 w-[300px] border-l bg-background flex flex-col shadow-xl animate-in slide-in-from-right duration-300 z-50">
                        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                            <h2 className="font-semibold text-sm">Citations</h2>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={closeCitationsSidebar}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
                            {sources.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center mt-10">No citations found.</p>
                            ) : (
                                sources.map((src, idx) => {
                                    const isDocument = isDocumentSource(src.url)
                                    const route = isDocument ? getDocumentRoute(src.url) : null

                                    const inner = (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 rounded-sm overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                                    {isDocument ? (
                                                        <FileText className="h-3 w-3 text-primary/70" />
                                                    ) : (
                                                        <SourceFavicon url={src.url} size={16} className="h-4 w-4 object-contain" />
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                                    {isDocument ? 'Document' : getCitationSourceDisplayName(src.url, src.title)}
                                                </span>
                                                {!isDocument && (
                                                    <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors ml-auto" />
                                                )}
                                            </div>
                                            <h3 className="text-xs font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                                {src.title}
                                            </h3>
                                            <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                                                {src.snippet || (isDocument ? 'Document' : src.url)}
                                            </p>
                                        </div>
                                    )

                                    if (isDocument && route) {
                                        return (
                                            <div
                                                key={idx}
                                                className="group block space-y-2 border-b border-border/40 pb-4 last:border-0 cursor-pointer"
                                                onClick={() => { closeCitationsSidebar(); window.open(route, '_blank') }}
                                            >
                                                {inner}
                                            </div>
                                        )
                                    }

                                    return (
                                        <a
                                            key={idx}
                                            href={src.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group block space-y-2 border-b border-border/40 pb-4 last:border-0"
                                        >
                                            {inner}
                                        </a>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )
            })()}
            {/* Clear Chat Confirmation Dialog */}
            {showClearConfirm && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                        onClick={() => setShowClearConfirm(false)}
                    />
                    {/* Dialog */}
                    <div className="relative z-50 w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-foreground">Clear chat history?</h2>
                            <p className="text-sm text-muted-foreground">
                                This will permanently delete all messages in this review chat. This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowClearConfirm(false)}
                                className="rounded-lg"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleClearChat}
                                className="rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                            >
                                Clear Chat
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
