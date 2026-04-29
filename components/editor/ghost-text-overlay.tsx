"use client"

interface GhostTextOverlayProps {
    suggestion: string
    isLoading: boolean
}

/**
 * Renders the ghost text suggestion as a subtle overlay near the cursor.
 * Press Tab to accept, Escape to dismiss.
 */
export function GhostTextOverlay({ suggestion, isLoading }: GhostTextOverlayProps) {
    if (!suggestion && !isLoading) return null

    // Position near cursor
    const selection = typeof window !== 'undefined' ? window.getSelection() : null
    if (!selection || !selection.rangeCount) return null

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    if (rect.top === 0 && rect.left === 0) return null

    if (isLoading) {
        return (
            <div
                className="fixed z-30 pointer-events-none"
                style={{ top: rect.top - 2, left: rect.right + 4 }}
            >
                <span className="text-muted-foreground/40 text-[15px] animate-pulse">•••</span>
            </div>
        )
    }

    return (
        <div
            className="fixed z-30 pointer-events-none"
            style={{ top: rect.top - 2, left: rect.right + 2 }}
        >
            <span className="text-muted-foreground/40 text-[15px] italic">
                {suggestion}
            </span>
            <span className="ml-2 text-[10px] text-muted-foreground/30 bg-muted/30 px-1 rounded">
                Tab
            </span>
        </div>
    )
}
