"use client"

import React from 'react'

interface SuggestionLeafProps {
    attributes: React.HTMLAttributes<HTMLSpanElement>
    children: React.ReactNode
    leaf: {
        suggestion_remove?: string | boolean
        suggestion_add?: string | boolean
        [key: string]: unknown
    }
}

/**
 * Custom Plate.js leaf renderer for suggestion marks.
 *
 * Renders two types of marks:
 * - `suggestion_remove`: Red strikethrough (original text to be replaced)
 * - `suggestion_add`: Green underline (AI replacement text)
 */
export function SuggestionLeaf({ attributes, children, leaf }: SuggestionLeafProps) {
    let el = <>{children}</>

    // Suggestion: text to remove (original)
    if (leaf.suggestion_remove) {
        el = (
            <span
                className="suggestion-remove line-through decoration-red-500/60 text-red-500/70 bg-red-500/10 rounded-sm px-[1px]"
                data-suggestion-id={leaf.suggestion_remove}
                data-suggestion-type="remove"
            >
                {el}
            </span>
        )
    }

    // Suggestion: text to add (AI replacement)
    if (leaf.suggestion_add) {
        el = (
            <span
                className="suggestion-add underline decoration-emerald-500/60 decoration-solid text-emerald-500/90 bg-emerald-500/10 rounded-sm px-[1px]"
                data-suggestion-id={leaf.suggestion_add}
                data-suggestion-type="add"
            >
                {el}
            </span>
        )
    }

    return <span {...attributes}>{el}</span>
}
