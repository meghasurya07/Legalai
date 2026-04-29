"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseGhostTextOptions {
    editor: { children: unknown[]; selection: unknown } | null
    documentType?: string
    enabled?: boolean
    debounceMs?: number
}

interface GhostTextState {
    suggestion: string
    isLoading: boolean
    position: { top: number; left: number } | null
}

/**
 * Custom ghost text hook — provides AI autocomplete suggestions as the user types.
 * Press Tab to accept the suggestion.
 */
export function useGhostText({
    editor,
    documentType = 'general',
    enabled = true,
    debounceMs = 800,
}: UseGhostTextOptions): GhostTextState & {
    accept: () => void
    dismiss: () => void
} {
    const [suggestion, setSuggestion] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const lastTextRef = useRef('')

    const fetchSuggestion = useCallback(async (text: string) => {
        if (!text || text.length < 10) return

        // Abort previous request
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setIsLoading(true)
        try {
            const res = await fetch('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prefix: text.slice(-2000), // Last 2000 chars for context
                    suffix: '',
                    documentType,
                }),
                signal: controller.signal,
            })

            if (!res.ok || !res.body) return

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let accumulated = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value)
                // Parse SSE data
                const lines = chunk.split('\n')
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue
                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.text) {
                                accumulated += parsed.text
                            }
                        } catch {
                            // Not JSON, might be raw text
                            if (data && data !== '[DONE]') {
                                accumulated += data
                            }
                        }
                    }
                }
            }

            if (accumulated && !controller.signal.aborted) {
                // Limit suggestion to a reasonable length (one sentence or clause)
                const firstSentenceEnd = accumulated.search(/[.!?]\s/)
                const trimmed = firstSentenceEnd > 0
                    ? accumulated.slice(0, firstSentenceEnd + 1)
                    : accumulated.slice(0, 100)

                setSuggestion(trimmed.trim())
                updatePosition()
            }
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error('Ghost text error:', err)
            }
        } finally {
            setIsLoading(false)
        }
    }, [documentType])

    const updatePosition = useCallback(() => {
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setPosition({ top: rect.top, left: rect.right })
    }, [])

    // Listen for text changes
    useEffect(() => {
        if (!enabled || !editor) return

        const handleInput = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)

            // Dismiss current suggestion on new input
            setSuggestion('')

            // Extract current text from editor
            const text = extractText(editor.children)
            if (text === lastTextRef.current) return
            lastTextRef.current = text

            debounceRef.current = setTimeout(() => {
                fetchSuggestion(text)
            }, debounceMs)
        }

        // Use MutationObserver on the editor DOM
        const editorEl = document.querySelector('[data-slate-editor]')
        if (!editorEl) return

        const observer = new MutationObserver(handleInput)
        observer.observe(editorEl, {
            childList: true,
            characterData: true,
            subtree: true,
        })

        return () => {
            observer.disconnect()
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [enabled, editor, fetchSuggestion, debounceMs])

    // Tab key handler
    useEffect(() => {
        if (!suggestion) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab' && suggestion) {
                e.preventDefault()
                accept()
            } else if (e.key === 'Escape') {
                dismiss()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suggestion])

    const accept = useCallback(() => {
        if (!suggestion) return

        // Insert the suggestion at the current cursor position
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            range.deleteContents()
            const textNode = document.createTextNode(suggestion)
            range.insertNode(textNode)

            // Move cursor to end of inserted text
            range.setStartAfter(textNode)
            range.setEndAfter(textNode)
            selection.removeAllRanges()
            selection.addRange(range)
        }

        setSuggestion('')
        setPosition(null)
    }, [suggestion])

    const dismiss = useCallback(() => {
        setSuggestion('')
        setPosition(null)
        if (abortRef.current) abortRef.current.abort()
    }, [])

    return { suggestion, isLoading, position, accept, dismiss }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(children: any): string {
    if (!children || !Array.isArray(children)) return ''
    let text = ''
    for (const node of children) {
        if (typeof node.text === 'string') {
            text += node.text
        }
        if (node.children) {
            text += extractText(node.children)
        }
    }
    return text
}
