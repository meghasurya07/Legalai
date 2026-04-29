"use client"

import React, { useMemo, useCallback, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import {
    Plate,
    PlateContent,
    type PlateEditor as PlateEditorType,
    createPlateEditor,
} from 'platejs/react'
import {
    BoldPlugin,
    ItalicPlugin,
    UnderlinePlugin,
    StrikethroughPlugin,
    HighlightPlugin,
    HeadingPlugin,
    BlockquotePlugin,
    HorizontalRulePlugin,
} from '@platejs/basic-nodes/react'
import { EditorToolbar } from './editor-toolbar'
import { FloatingToolbar } from './floating-toolbar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorValue = any[]

export interface PlateEditorHandle {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEditor: () => any
}

interface PlateEditorProps {
    initialContent?: EditorValue
    onContentChange?: (content: EditorValue, plainText: string, wordCount: number) => void
    onAICommand?: (position: { top: number; left: number }) => void
    onInlineAICommand?: (command: string, commandLabel: string, selectedText: string) => void
    documentType?: string
    readOnly?: boolean
}

function extractPlainText(nodes: EditorValue): string {
    let text = ''
    for (const node of nodes) {
        if (node.children) {
            for (const child of node.children) {
                if (typeof child.text === 'string') {
                    text += child.text
                } else if (child.children) {
                    text += extractPlainText([child])
                }
            }
            text += '\n'
        }
    }
    return text.trim()
}

function countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length
}

const defaultContent: EditorValue = [
    { type: 'p', children: [{ text: '' }] },
]

/**
 * Custom HorizontalRule component — renders as a styled div separator
 * instead of an <hr> tag to avoid the "void element with children" React error.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HorizontalRuleElement = React.forwardRef<HTMLDivElement, any>(
    ({ attributes, children }, ref) => {
        return (
            <div ref={ref} {...attributes} className="py-1">
                <div contentEditable={false} className="my-4 border-t border-border" />
                {children}
            </div>
        )
    }
)
HorizontalRuleElement.displayName = 'HorizontalRuleElement'

/**
 * Custom leaf renderer that handles suggestion marks alongside normal text marks.
 */
interface SuggestionLeafProps {
    attributes: React.HTMLAttributes<HTMLSpanElement>
    children: React.ReactNode
    leaf: {
        suggestion_remove?: string | boolean
        suggestion_add?: string | boolean
        [key: string]: unknown
    }
}

function SuggestionAwareLeaf(props: SuggestionLeafProps) {
    const { attributes, children, leaf } = props
    let el = <>{children}</>

    // Suggestion: text to remove (original — red strikethrough)
    if (leaf.suggestion_remove) {
        el = (
            <span
                className="suggestion-remove line-through decoration-red-500/60 text-red-500/70 bg-red-500/10 rounded-sm px-[1px]"
                data-suggestion-id={leaf.suggestion_remove as string}
                data-suggestion-type="remove"
            >
                {el}
            </span>
        )
    }

    // Suggestion: text to add (AI replacement — green underline)
    if (leaf.suggestion_add) {
        el = (
            <span
                className="suggestion-add underline decoration-emerald-500/60 decoration-solid text-emerald-500/90 bg-emerald-500/10 rounded-sm px-[1px]"
                data-suggestion-id={leaf.suggestion_add as string}
                data-suggestion-type="add"
            >
                {el}
            </span>
        )
    }

    return (
        <span {...attributes}>
            {el}
        </span>
    )
}

export const PlateEditor = forwardRef<PlateEditorHandle, PlateEditorProps>(function PlateEditorInner({
    initialContent,
    onContentChange,
    onAICommand,
    onInlineAICommand,
    readOnly = false,
}, ref) {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const editor = useMemo(() => {
        return createPlateEditor({
            plugins: [
                BoldPlugin,
                ItalicPlugin,
                UnderlinePlugin,
                StrikethroughPlugin,
                HighlightPlugin,
                HeadingPlugin,
                BlockquotePlugin,
                HorizontalRulePlugin,
            ],
            override: {
                components: {
                    [HorizontalRulePlugin.key]: HorizontalRuleElement,
                },
            },
            value: initialContent && initialContent.length > 0 ? initialContent : defaultContent,
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Expose editor instance to parent via ref
    useImperativeHandle(ref, () => ({
        getEditor: () => editor,
    }), [editor])

    const handleChange = useCallback(({ value }: { value: EditorValue }) => {
        if (!onContentChange) return
        if (debounceRef.current) clearTimeout(debounceRef.current)

        debounceRef.current = setTimeout(() => {
            const plainText = extractPlainText(value)
            const wordCount = countWords(plainText)
            onContentChange(value, plainText, wordCount)
        }, 2000)
    }, [onContentChange])

    if (!isMounted) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground text-sm">Loading editor...</div>
            </div>
        )
    }

    return (
        <Plate
            editor={editor as PlateEditorType}
            onChange={handleChange}
        >
            <EditorToolbar editor={editor as PlateEditorType} readOnly={readOnly} />
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-8 md:px-16 py-8">
                    <PlateContent
                        readOnly={readOnly}
                        renderLeaf={(props) => <SuggestionAwareLeaf {...props} />}
                        className="min-h-[60vh] outline-none prose prose-neutral dark:prose-invert max-w-none
                            [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:leading-tight
                            [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5
                            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4
                            [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-[15px]
                            [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
                            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
                            [&_li]:mb-1 [&_li]:text-[15px]
                            selection:bg-primary/20"
                        placeholder="Start drafting your document..."
                        spellCheck
                        autoFocus
                    />
                </div>
            </div>
            {!readOnly && (
                <FloatingToolbar
                    editor={editor}
                    onAICommand={onAICommand || (() => {})}
                    onInlineAICommand={onInlineAICommand}
                />
            )}
        </Plate>
    )
})
