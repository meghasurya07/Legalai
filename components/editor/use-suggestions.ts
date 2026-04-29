"use client"

import { useState, useCallback } from 'react'

export interface Suggestion {
    id: string
    originalText: string
    replacementText: string
    command: string
    commandLabel: string
    status: 'pending' | 'accepted' | 'rejected'
    createdAt: number
}

// Simple unique ID generator
function generateId(): string {
    return `sg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Extracts plain text from a Plate editor's current selection using the DOM.
 */
function getSelectedText(): string {
    const sel = window.getSelection()
    return sel ? sel.toString() : ''
}

export interface SuggestionNode {
    suggestion_add?: string | boolean
    suggestion_remove?: string | boolean
    children?: SuggestionNode[]
    [key: string]: unknown
}

function findSuggestionNodes(children: SuggestionNode[], id: string, type: 'add' | 'remove', currentPath: number[] = []): Array<[SuggestionNode, number[]]> {
    let results: Array<[SuggestionNode, number[]]> = []

    for (let i = 0; i < children.length; i++) {
        const node = children[i]
        const path = [...currentPath, i]

        if (type === 'add' && node.suggestion_add === id) {
            results.push([node, path])
        }
        if (type === 'remove' && node.suggestion_remove === id) {
            results.push([node, path])
        }

        if (node.children && Array.isArray(node.children)) {
            results = results.concat(findSuggestionNodes(node.children, id, type, path))
        }
    }

    return results
}

interface UseSuggestionsReturn {
    suggestions: Suggestion[]
    activeSuggestionId: string | null
    setActiveSuggestionId: (id: string | null) => void
    createSuggestion: (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor: any,
        replacementText: string,
        command: string,
        commandLabel: string,
    ) => string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    acceptSuggestion: (editor: any, id: string) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rejectSuggestion: (editor: any, id: string) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    acceptAll: (editor: any) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rejectAll: (editor: any) => void
    pendingCount: number
}

/**
 * Core hook for managing inline AI suggestions in the Plate.js editor.
 *
 * Suggestions work by applying custom marks to text:
 * - `suggestion_remove`: marks the original text (shown as red strikethrough)
 * - `suggestion_add`: marks the AI replacement text (shown as green underline)
 *
 * Both marks store the suggestion ID as their value, allowing us to
 * group and manage add/remove pairs.
 */
export function useSuggestions(): UseSuggestionsReturn {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null)

    const pendingCount = suggestions.filter(s => s.status === 'pending').length

    /**
     * Creates an inline suggestion by:
     * 1. Marking the currently selected text with `suggestion_remove: id`
     * 2. Inserting the replacement text after with `suggestion_add: id`
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSuggestion = useCallback((editor: any, replacementText: string, command: string, commandLabel: string): string | null => {
        if (!editor || !editor.selection) return null

        const originalText = getSelectedText()
        if (!originalText.trim()) return null

        const id = generateId()

        // Save the current selection
        const sel = editor.selection

        try {
            // Step 1: Mark the selected text as "to be removed"
            editor.addMark('suggestion_remove', id)

            // Step 2: Move cursor to end of selection
            const end = sel.focus.offset >= sel.anchor.offset ? sel.focus : sel.anchor
            editor.select({ anchor: end, focus: end })

            // Step 3: Insert the replacement text with the "add" mark
            // First set the mark, then insert text
            editor.addMark('suggestion_add', id)
            editor.insertText(replacementText)

            // Step 4: Remove the add mark for future typing
            editor.removeMark('suggestion_add')
            editor.removeMark('suggestion_remove')

            // Step 5: Collapse selection to end
            editor.deselect()

            // Track the suggestion
            const suggestion: Suggestion = {
                id,
                originalText,
                replacementText,
                command,
                commandLabel,
                status: 'pending',
                createdAt: Date.now(),
            }

            setSuggestions(prev => [...prev, suggestion])
            setActiveSuggestionId(id)

            return id
        } catch (err) {
            console.error('Failed to create suggestion:', err)
            return null
        }
    }, [])

    /**
     * Accepts a suggestion:
     * - Removes all text nodes with `suggestion_remove: id`
     * - Unmarks all text nodes with `suggestion_add: id` (keeps the text)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acceptSuggestion = useCallback((editor: any, id: string) => {
        if (!editor) return

        try {
            // Find and remove all "remove" nodes with this suggestion ID
            const removeNodes = findSuggestionNodes(editor.children, id, 'remove')

            // Find all "add" nodes with this suggestion ID
            const addNodes = findSuggestionNodes(editor.children, id, 'add')

            // Process in reverse order to preserve paths
            // First: unmark the "add" text (keep it as regular text)
            for (const [, path] of addNodes.reverse()) {
                editor.select({ anchor: { path, offset: 0 }, focus: { path, offset: 0 } })
                editor.tf.setNodes(
                    { suggestion_add: undefined },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { at: path, match: (n: any) => n.suggestion_add === id }
                )
            }

            // Then: remove the "remove" text
            for (const [, path] of removeNodes.reverse()) {
                editor.tf.removeNodes({ at: path })
            }

            editor.deselect()

            setSuggestions(prev =>
                prev.map(s => s.id === id ? { ...s, status: 'accepted' as const } : s)
            )

            if (activeSuggestionId === id) {
                setActiveSuggestionId(null)
            }
        } catch (err) {
            console.error('Failed to accept suggestion:', err)
        }
    }, [activeSuggestionId])

    /**
     * Rejects a suggestion:
     * - Removes all text nodes with `suggestion_add: id`
     * - Unmarks all text nodes with `suggestion_remove: id` (restores original)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rejectSuggestion = useCallback((editor: any, id: string) => {
        if (!editor) return

        try {
            // Find "add" nodes (AI text to remove)
            const addNodes = findSuggestionNodes(editor.children, id, 'add')

            // Find "remove" nodes (original text to restore)
            const removeNodes = findSuggestionNodes(editor.children, id, 'remove')

            // Unmark the original text first
            for (const [, path] of removeNodes.reverse()) {
                editor.tf.setNodes(
                    { suggestion_remove: undefined },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { at: path, match: (n: any) => n.suggestion_remove === id }
                )
            }

            // Then delete the AI-generated text
            for (const [, path] of addNodes.reverse()) {
                editor.tf.removeNodes({ at: path })
            }

            editor.deselect()

            setSuggestions(prev =>
                prev.map(s => s.id === id ? { ...s, status: 'rejected' as const } : s)
            )

            if (activeSuggestionId === id) {
                setActiveSuggestionId(null)
            }
        } catch (err) {
            console.error('Failed to reject suggestion:', err)
        }
    }, [activeSuggestionId])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acceptAll = useCallback((editor: any) => {
        const pending = suggestions.filter(s => s.status === 'pending')
        for (const s of pending) {
            acceptSuggestion(editor, s.id)
        }
    }, [suggestions, acceptSuggestion])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rejectAll = useCallback((editor: any) => {
        const pending = suggestions.filter(s => s.status === 'pending')
        for (const s of pending) {
            rejectSuggestion(editor, s.id)
        }
    }, [suggestions, rejectSuggestion])

    return {
        suggestions,
        activeSuggestionId,
        setActiveSuggestionId,
        createSuggestion,
        acceptSuggestion,
        rejectSuggestion,
        acceptAll,
        rejectAll,
        pendingCount,
    }
}
