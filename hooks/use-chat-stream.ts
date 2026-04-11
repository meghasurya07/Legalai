"use client"

import * as React from "react"
import { toast } from "sonner"
import type { Attachment, Message } from "@/types"
import type { ActivityPhase } from "@/components/chat/activity-timeline"

// Map UI conversation types to database types
const DB_TYPE_MAP: Record<string, string> = {
    'documents': 'vault',
    'templates': 'workflow',
    'assistant': 'assistant',
}

interface UseChatStreamOptions {
    projectId?: string
    workflowId?: string
    conversationType?: 'assistant' | 'documents' | 'templates'
    initialConversationId?: string
    onMessageSent?: () => void
}

export function useChatStream({
    projectId,
    workflowId,
    conversationType = 'assistant',
    initialConversationId,
    onMessageSent,
}: UseChatStreamOptions) {
    // ─── Core Chat State ─────────────────────────────────────────
    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [conversationId, setConversationId] = React.useState<string | null>(initialConversationId || null)

    // ─── Input State ─────────────────────────────────────────────
    const [inputValue, setInputValue] = React.useState("")
    const [isImprovingPrompt, setIsImprovingPrompt] = React.useState(false)
    const [uploadedFiles, setUploadedFiles] = React.useState<Attachment[]>([])
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)

    // ─── Mode Toggles ────────────────────────────────────────────
    const [isThinking, setIsThinking] = React.useState(false)
    const [isWebSearch, setIsWebSearch] = React.useState(false)
    const [isDeepResearch, setIsDeepResearch] = React.useState(false)
    const [isConfidenceMode, setIsConfidenceMode] = React.useState(false)
    const queryMode = "ask"

    // ─── Activity / Thinking State ───────────────────────────────
    const [activityPhase, setActivityPhase] = React.useState<ActivityPhase>(null)
    const [activityEntries, setActivityEntries] = React.useState<{ phase: string; detail: string; time: Date }[]>([])
    const [isActivitySidebarOpen, setIsActivitySidebarOpen] = React.useState(false)
    const thinkingStartRef = React.useRef<number | null>(null)
    const [thinkingDuration, setThinkingDuration] = React.useState<number | null>(null)

    // ─── Scroll Refs ─────────────────────────────────────────────
    const chatContainerRef = React.useRef<HTMLDivElement>(null)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)
    const isAtBottomRef = React.useRef(true)

    // ─── Abort Controller ────────────────────────────────────────
    const abortControllerRef = React.useRef<AbortController | null>(null)

    // ─── Load Existing Conversation ──────────────────────────────
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
                        setTimeout(() => {
                            if (chatContainerRef.current) {
                                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
                                isAtBottomRef.current = true
                            }
                        }, 100)
                    }
                } catch {
                    // Silently fail
                }
            }
            loadConversation()
        } else {
            setConversationId(null)
            setMessages([])
        }
    }, [initialConversationId])

    // ─── Scroll Helpers ──────────────────────────────────────────
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

    // ─── Stop Handler ────────────────────────────────────────────
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setIsLoading(false)
        setActivityPhase(null)
    }

    // ─── Improve Prompt ──────────────────────────────────────────
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
        } catch {
            toast.error("An error occurred while improving the prompt")
            setInputValue(originalInput)
        } finally {
            setIsImprovingPrompt(false)
        }
    }

    // ─── Send Message (SSE Streaming) ────────────────────────────
    const handleSend = async () => {
        if ((!inputValue.trim() && uploadedFiles.length === 0) || isLoading) return

        const userMessage = inputValue.trim()
        const currentFiles = [...uploadedFiles]
        setMessages(prev => [...prev, { role: 'user', content: userMessage || (currentFiles.length > 0 ? `Sent ${currentFiles.length} file(s)` : ""), files: currentFiles }])
        setInputValue("")

        isAtBottomRef.current = true
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
            }
        }, 10)

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
                if (file.source === 'drive' || !file.file) {
                    return { name: file.name, type: file.type }
                }
                try {
                    const formData = new FormData()
                    formData.append('file', file.file)
                    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
                    if (res.ok) {
                        const data = await res.json()
                        return { id: data.id, name: file.name, type: file.type, content: data.content }
                    } else {
                        throw new Error('Upload failed')
                    }
                } catch {
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
                    conversationId: currentConversationId,
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
                    buffer = rawLines.pop() || ''

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
                                    const { phase, status, detail } = parsed

                                    if (status === 'start') {
                                        if (phase === 'thinking' || phase === 'searching_web') {
                                            thinkingStartRef.current = Date.now()
                                            setThinkingDuration(null)
                                        }
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
                                    if (!assistantMsgAdded) {
                                        setMessages(prev => [...prev, { role: 'assistant', content: '', isWebSearch }])
                                        assistantMsgAdded = true
                                    }
                                    if (thinkingStartRef.current && !thinkingDuration) {
                                        const elapsed = Math.round((Date.now() - thinkingStartRef.current) / 1000)
                                        setThinkingDuration(elapsed > 0 ? elapsed : 1)
                                        thinkingStartRef.current = null
                                    }
                                    if (parsed.replace) {
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

                            currentEvent = ''
                        }
                    }
                }
            }

            if (onMessageSent) onMessageSent()
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                // User cancelled
            } else {
                toast.error('Failed to send message')
            }
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
    }

    // ─── File Upload ─────────────────────────────────────────────
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const incomingFiles = Array.from(files)
            const duplicates = incomingFiles.filter(f => uploadedFiles.some(existing => existing.name === f.name))

            if (duplicates.length > 0) {
                setIsDuplicateModalOpen(true)
            }

            const uniqueFiles = incomingFiles.filter(f => !uploadedFiles.some(existing => existing.name === f.name))

            if (uniqueFiles.length === 0) return

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
        }
    }

    const removeFile = (fileName: string) => {
        setUploadedFiles(prev => prev.filter(f => f.name !== fileName))
    }

    return {
        // Core
        messages,
        isLoading,
        conversationId,
        // Input
        inputValue, setInputValue,
        isImprovingPrompt,
        uploadedFiles, setUploadedFiles,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        // Mode toggles
        isThinking, setIsThinking,
        isWebSearch, setIsWebSearch,
        isDeepResearch, setIsDeepResearch,
        isConfidenceMode, setIsConfidenceMode,
        // Activity
        activityPhase,
        activityEntries,
        thinkingDuration,
        isActivitySidebarOpen, setIsActivitySidebarOpen,
        // Scroll
        chatContainerRef,
        messagesEndRef,
        handleScroll,
        // Handlers
        handleSend,
        handleStop,
        handleImprovePrompt,
        handleFileUpload,
        removeFile,
    }
}
