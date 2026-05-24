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
 *  - Loading, result, error, retry, and elapsed-time state
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
    const [error, setError] = React.useState<string | null>(null)
    const [generatedAt, setGeneratedAt] = React.useState<Date | null>(null)
    const [processingStep, setProcessingStep] = React.useState(0)
    const [elapsedSeconds, setElapsedSeconds] = React.useState(0)

    // Last request data for retry
    const lastRequestRef = React.useRef<{
        type: 'file' | 'json'
        data: FormData | Record<string, unknown>
        successMessage: string
    } | null>(null)

    // ─── Elapsed time tracking ───────────────────────────────────
    React.useEffect(() => {
        if (!isRunning) {
            return
        }
        setElapsedSeconds(0)
        const interval = setInterval(() => {
            setElapsedSeconds(prev => prev + 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [isRunning])

    // ─── Simulated processing steps ──────────────────────────────
    React.useEffect(() => {
        if (!isRunning) {
            setProcessingStep(0)
            return
        }
        // Step 0 = uploading (immediate)
        // Step 1 = extracting text (after 1s)
        // Step 2 = analyzing (after 3s)
        const t1 = setTimeout(() => setProcessingStep(1), 1000)
        const t2 = setTimeout(() => setProcessingStep(2), 3000)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [isRunning])

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
                            setGeneratedAt(new Date(assistantMsg.created_at || Date.now()))
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
        setError(null)
        toast.success("File uploaded")
    }, [file])

    // ─── Run workflow with FormData (file upload) ────────────────
    const runWithFile = React.useCallback(async (formData: FormData, successMessage = "Analysis complete!") => {
        setIsRunning(true)
        setError(null)
        lastRequestRef.current = { type: 'file', data: formData, successMessage }

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ error: 'Analysis failed' }))
                throw new Error(errorBody.error || `Analysis failed (${response.status})`)
            }

            const data = await response.json()
            setResult(data)
            setGeneratedAt(new Date())
            toast.success(successMessage)
            return data
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Analysis failed"
            setError(message)
            toast.error(message)
            return null
        } finally {
            setIsRunning(false)
        }
    }, [apiEndpoint])

    // ─── Run workflow with JSON body ─────────────────────────────
    const runWithJson = React.useCallback(async (body: Record<string, unknown>, successMessage = "Analysis complete!") => {
        setIsRunning(true)
        setError(null)
        lastRequestRef.current = { type: 'json', data: body, successMessage }

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ error: 'Analysis failed' }))
                throw new Error(errorBody.error || `Analysis failed (${response.status})`)
            }

            const data = await response.json()
            setResult(data)
            setGeneratedAt(new Date())
            toast.success(successMessage)
            return data
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Analysis failed"
            setError(message)
            toast.error(message)
            return null
        } finally {
            setIsRunning(false)
        }
    }, [apiEndpoint])

    // ─── Retry last request ──────────────────────────────────────
    const retry = React.useCallback(async () => {
        const last = lastRequestRef.current
        if (!last) return null

        if (last.type === 'file') {
            return runWithFile(last.data as FormData, last.successMessage)
        } else {
            return runWithJson(last.data as Record<string, unknown>, last.successMessage)
        }
    }, [runWithFile, runWithJson])

    // ─── Reset ───────────────────────────────────────────────────
    const reset = React.useCallback(() => {
        setFile(null)
        setResult(null)
        setError(null)
        setGeneratedAt(null)
        lastRequestRef.current = null
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
        // Production features
        error,
        retry,
        generatedAt,
        processingStep,
        elapsedSeconds,
    }
}
