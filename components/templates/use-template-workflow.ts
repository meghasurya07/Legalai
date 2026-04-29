"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"

/**
 * Shared hook for template workflow components.
 *
 * Encapsulates:
 *  - chatId extraction from URL params
 *  - History loading from a past conversation
 *  - File state management with duplicate detection
 *  - Workflow execution via FormData or JSON POST
 *  - Loading & result state
 *
 * @template T — The shape of the analysis/result data.
 */
export function useTemplateWorkflow<T>(options: {
    /** API endpoint to call, e.g. '/api/templates/contract-analysis' */
    apiEndpoint: string
    /** Optional: file field name in FormData (default: first field) */
    fileFieldName?: string
}) {
    const { apiEndpoint } = options

    // ─── Chat ID from URL ────────────────────────────────────────
    const params = useParams()
    const chatIdParam = params.chatId as string[] | undefined
    const chatId = chatIdParam && chatIdParam[0] === 'chat' && chatIdParam[1] ? chatIdParam[1] : undefined

    // ─── State ───────────────────────────────────────────────────
    const [file, setFile] = React.useState<File | null>(null)
    const [isRunning, setIsRunning] = React.useState(false)
    const [result, setResult] = React.useState<T | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)

    // ─── Load history ────────────────────────────────────────────
    React.useEffect(() => {
        if (!chatId) return

        const loadHistory = async () => {
            setIsRunning(true)
            try {
                const res = await fetch(`/api/chat/conversations/${chatId}/messages`)
                if (res.ok) {
                    const messages = await res.json()
                    const assistantMsg = messages.find((m: { role: string; content: string }) => m.role === 'assistant')
                    if (assistantMsg) {
                        try {
                            const parsedData = JSON.parse(assistantMsg.content)
                            setResult(parsedData)
                        } catch {
                            toast.error("Failed to load past result")
                        }
                    }
                }
            } catch {
                // Silent fail — non-critical
            } finally {
                setIsRunning(false)
            }
        }

        loadHistory()
    }, [chatId])

    // ─── File handling ───────────────────────────────────────────
    const handleFileSelect = React.useCallback((newFile: File) => {
        if (file && file.name === newFile.name) {
            setIsDuplicateModalOpen(true)
            return
        }
        setFile(newFile)
        toast.success("File uploaded")
    }, [file])

    // ─── Run workflow with FormData (file upload) ────────────────
    const runWithFile = React.useCallback(async (formData: FormData, successMessage = "Analysis complete!") => {
        setIsRunning(true)
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Analysis failed')
            }

            const data = await response.json()
            setResult(data)
            toast.success(successMessage)
            return data
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Analysis failed"
            toast.error(message)
            return null
        } finally {
            setIsRunning(false)
        }
    }, [apiEndpoint])

    // ─── Run workflow with JSON body ─────────────────────────────
    const runWithJson = React.useCallback(async (body: Record<string, unknown>, successMessage = "Analysis complete!") => {
        setIsRunning(true)
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Analysis failed')
            }

            const data = await response.json()
            setResult(data)
            toast.success(successMessage)
            return data
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Analysis failed"
            toast.error(message)
            return null
        } finally {
            setIsRunning(false)
        }
    }, [apiEndpoint])

    // ─── Reset ───────────────────────────────────────────────────
    const reset = React.useCallback(() => {
        setFile(null)
        setResult(null)
    }, [])

    return {
        // URL
        chatId,
        // File
        file, setFile,
        handleFileSelect,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        // Workflow
        isRunning,
        result, setResult,
        runWithFile,
        runWithJson,
        reset,
    }
}
