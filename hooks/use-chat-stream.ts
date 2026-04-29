"use client"

import * as React from "react"
import { toast } from "sonner"
import type { Attachment, Message } from "@/types"
import type { ActivityPhase } from "@/components/chat/activity-timeline"
import {
    getAttachmentType,
    splitDuplicateFiles,
    createAttachmentFromFile,
    revokeAttachmentObjectUrl,
    revokeAttachmentObjectUrls,
    uploadAttachmentForChat,
    toDisplayAttachment,
    toPersistedAttachment,
} from "@/lib/chat/attachment-utils"

// Re-export for consumers that import from this file
export { getAttachmentType, splitDuplicateFiles, createAttachmentFromFile, revokeAttachmentObjectUrl }

// Map UI conversation types to database types
const DB_TYPE_MAP: Record<string, string> = {
    'documents': 'vault',
    'templates': 'workflow',
    'assistant': 'assistant',
}

type AddFilesMessage = string | ((count: number) => string)

interface AddFilesOptions {
    successMessage?: AddFilesMessage
}

function getAddFilesSuccessMessage(message: AddFilesMessage | undefined, count: number): string {
    if (typeof message === 'function') return message(count)
    if (message) return message
    return `Uploaded ${count} file(s)`
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
    const uploadedFilesRef = React.useRef<Attachment[]>([])

    React.useEffect(() => {
        uploadedFilesRef.current = uploadedFiles
    }, [uploadedFiles])

    React.useEffect(() => {
        return () => revokeAttachmentObjectUrls(uploadedFilesRef.current)
    }, [])

    const addFilesToUploadQueue = React.useCallback((files: File[] | FileList, options?: AddFilesOptions) => {
        const incomingFiles = Array.from(files)
        if (incomingFiles.length === 0) return 0

        const { uniqueFiles, duplicateFiles } = splitDuplicateFiles(incomingFiles, uploadedFiles)

        if (duplicateFiles.length > 0) {
            setIsDuplicateModalOpen(true)
        }

        if (uniqueFiles.length === 0) return 0

        const newAttachments = uniqueFiles.map((file) => createAttachmentFromFile(file))
        setUploadedFiles(prev => [...prev, ...newAttachments])
        toast.success(getAddFilesSuccessMessage(options?.successMessage, uniqueFiles.length))

        return uniqueFiles.length
    }, [uploadedFiles])

    // ─── Load Existing Conversation ──────────────────────────────
    React.useEffect(() => {
        if (initialConversationId) {
            setConversationId(initialConversationId)
            const loadConversation = async () => {
                try {
                    const res = await fetch(`/api/chat/conversations/${initialConversationId}/messages`)
                    if (res.ok) {
                        const data = await res.json()
                        const loadedMessages = data.map((msg: { id: string, role: 'user' | 'assistant', content: string, attachments?: Attachment[] }) => ({
                            id: msg.id,
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
        const localUserMessageId = `local-user-${Date.now()}`
        const userDisplayContent = userMessage || (currentFiles.length > 0 ? `Sent ${currentFiles.length} file(s)` : "")
        setMessages(prev => [...prev, { id: localUserMessageId, role: 'user', content: userDisplayContent, files: currentFiles }])
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

            // Process files for extraction and storage
            const processedFiles = await Promise.all(currentFiles.map(uploadAttachmentForChat))
            const displayFiles = processedFiles.map((file, index) => toDisplayAttachment(currentFiles[index], file))

            if (displayFiles.length > 0) {
                setMessages(prev => prev.map(msg => (
                    msg.id === localUserMessageId ? { ...msg, files: displayFiles } : msg
                )))

                displayFiles.forEach((displayFile, index) => {
                    if (displayFile.url && displayFile.url !== currentFiles[index].url) {
                        revokeAttachmentObjectUrl(currentFiles[index])
                    }
                })
            }

            // Persist user message to database after upload so reloads can re-sign previews.
            if (currentConversationId) {
                const savedUserMessage = await fetch(`/api/chat/conversations/${currentConversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: 'user',
                        content: userDisplayContent,
                        attachments: processedFiles.map(toPersistedAttachment)
                    })
                })

                if (savedUserMessage.ok) {
                    const saved = await savedUserMessage.json()
                    if (saved?.id) {
                        setMessages(prev => prev.map(msg => (
                            msg.id === localUserMessageId ? { ...msg, id: saved.id } : msg
                        )))
                    }
                }
            }

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
                                } else if (currentEvent === 'messageId') {
                                    // Store the DB message ID on the last assistant message
                                    const { messageId: msgId } = parsed
                                    if (msgId) {
                                        setMessages(prev => {
                                            const updated = [...prev]
                                            if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                                                updated[updated.length - 1] = { ...updated[updated.length - 1], id: msgId }
                                            }
                                            return updated
                                        })
                                    }
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
            addFilesToUploadQueue(files)
            e.target.value = ''
        }
    }

    const removeFile = (fileName: string) => {
        setUploadedFiles(prev => {
            const removedFiles = prev.filter(f => f.name === fileName)
            revokeAttachmentObjectUrls(removedFiles)
            return prev.filter(f => f.name !== fileName)
        })
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
        addFilesToUploadQueue,
        removeFile,
    }
}
