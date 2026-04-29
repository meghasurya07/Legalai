"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Suggestion } from './use-suggestions'

interface SuggestionPopoverProps {
    suggestions: Suggestion[]
    activeSuggestionId: string | null
    onAccept: (id: string) => void
    onReject: (id: string) => void
    onAcceptAll: () => void
    onRejectAll: () => void
    onSetActive: (id: string | null) => void
    pendingCount: number
    isGenerating?: boolean
}

/**
 * Floating popover that appears near the active suggestion.
 * Provides Accept/Reject buttons and shows the AI command context.
 */
export function SuggestionPopover({
    suggestions,
    activeSuggestionId,
    onAccept,
    onReject,
    onAcceptAll,
    onRejectAll,
    onSetActive,
    pendingCount,
    isGenerating,
}: SuggestionPopoverProps) {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    const activeSuggestion = suggestions.find(s => s.id === activeSuggestionId && s.status === 'pending')

    // Position the popover near the suggestion mark in the DOM
    const updatePosition = useCallback(() => {
        if (!activeSuggestionId) {
            setPosition(null)
            return
        }

        // Find the suggestion element in the DOM
        const el = document.querySelector(`[data-suggestion-id="${activeSuggestionId}"][data-suggestion-type="add"]`)
            || document.querySelector(`[data-suggestion-id="${activeSuggestionId}"][data-suggestion-type="remove"]`)

        if (!el) {
            setPosition(null)
            return
        }

        const rect = el.getBoundingClientRect()
        const popoverWidth = 320

        // Position below the suggestion text
        setPosition({
            top: rect.bottom + 8,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 16)),
        })
    }, [activeSuggestionId])

    useEffect(() => {
        const timer = setTimeout(() => updatePosition(), 0)
        // Re-position on scroll/resize
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [updatePosition])

    useEffect(() => {
        if (popoverRef.current && position) {
            popoverRef.current.style.top = `${position.top}px`
            popoverRef.current.style.left = `${position.left}px`
        }
    }, [position])

    // Click outside to deactivate
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                // Check if clicking on a suggestion element
                const target = e.target as HTMLElement
                const suggestionEl = target.closest('[data-suggestion-id]')
                if (suggestionEl) {
                    const id = suggestionEl.getAttribute('data-suggestion-id')
                    if (id) {
                        onSetActive(id)
                        return
                    }
                }
            }
        }

        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onSetActive])

    // Navigate between pending suggestions
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
    const currentIndex = pendingSuggestions.findIndex(s => s.id === activeSuggestionId)

    const goToPrev = () => {
        if (currentIndex > 0) {
            onSetActive(pendingSuggestions[currentIndex - 1].id)
        }
    }
    const goToNext = () => {
        if (currentIndex < pendingSuggestions.length - 1) {
            onSetActive(pendingSuggestions[currentIndex + 1].id)
        }
    }

    if (isGenerating) {
        // Show a minimal loading indicator
        if (!position) return null
        return (
            <div
                ref={popoverRef}
                className="fixed z-50 bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl px-4 py-3 animate-in fade-in-0 zoom-in-95"
            >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                    <span>AI is rewriting...</span>
                </div>
            </div>
        )
    }

    if (!activeSuggestion || !position) return null

    return (
        <div
            ref={popoverRef}
            className="fixed z-50 bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl animate-in fade-in-0 zoom-in-95 w-[320px]"
            onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold">{activeSuggestion.commandLabel}</span>
                </div>
                {pendingCount > 1 && (
                    <div className="flex items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={goToPrev}
                            disabled={currentIndex <= 0}
                        >
                            <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                            {currentIndex + 1}/{pendingCount}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={goToNext}
                            disabled={currentIndex >= pendingSuggestions.length - 1}
                        >
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-3 py-2 flex items-center gap-2">
                <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onAccept(activeSuggestion.id)}
                >
                    <Check className="h-3 w-3" />
                    Accept
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 flex-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    onClick={() => onReject(activeSuggestion.id)}
                >
                    <X className="h-3 w-3" />
                    Reject
                </Button>
            </div>

            {/* Batch actions */}
            {pendingCount > 1 && (
                <div className="px-3 py-1.5 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                        {pendingCount} suggestions
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-emerald-600"
                            onClick={onAcceptAll}
                        >
                            Accept All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-red-500"
                            onClick={onRejectAll}
                        >
                            Reject All
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
