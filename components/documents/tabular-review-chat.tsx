"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Send, Loader2, Sparkles, FileText } from "lucide-react"
import { DocumentFile } from "@/types"
import type { ReviewColumn, ReviewCell } from "./tabular-review-view"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

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

    useEffect(() => {
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

        try {
            const tabularContext = buildTabularContext()
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    projectId,
                    customization: {
                        role: "Legal AI Assistant — Tabular Review Mode",
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

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value, { stream: true })
                const lines = text.split("\n")

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6)
                        if (data === "[DONE]") break
                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.content) {
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
                            // Skip non-JSON lines (phase events)
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Chat error:", err)
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
            }])
        } finally {
            setIsStreaming(false)
            // Save messages after streaming completes
            setMessages(current => {
                onSaveMessages?.(current)
                return current
            })
        }
    }

    const completedCount = Array.from(cells.values()).filter(c => c.status === "completed").length
    const totalPossible = documents.length * columns.length

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Review Chat</span>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
                    <X className="h-3.5 w-3.5" />
                </Button>
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
                {messages.map((msg, i) => (
                    <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
                        <div
                            className={
                                msg.role === "user"
                                    ? "bg-foreground text-background px-3 py-1.5 rounded-2xl rounded-br-sm text-[12px] max-w-[85%]"
                                    : "text-[12px] leading-relaxed whitespace-pre-wrap"
                            }
                        >
                            {msg.role === "assistant" ? (
                                <>
                                    <MarkdownRenderer content={msg.content} />
                                    {isStreaming && i === messages.length - 1 && (
                                        <span className="inline-block w-1.5 h-3.5 bg-foreground/60 ml-0.5 animate-pulse" />
                                    )}
                                </>
                            ) : (
                                msg.content
                            )}
                        </div>
                    </div>
                ))}
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
        </div>
    )
}
