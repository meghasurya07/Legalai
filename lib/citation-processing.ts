/**
 * Shared citation node-processing utilities.
 *
 * Both `message-bubble.tsx` and `markdown-renderer.tsx` need to walk the
 * React tree emitted by ReactMarkdown, replace ⟦CITE_N⟧ tokens with
 * CitationPill components, and skip code elements.  This module provides
 * that logic once, so the two consumers stay in sync.
 */

import React from 'react'
import { CitationPill } from '@/components/chat/citation-pill'
import type { ChatCitationSource, CitationEntry } from '@/lib/citations'

// ─── Types ───────────────────────────────────────────────────────────

export interface CitationCallbacks {
    /** Called when a citation is clicked (e.g., open sidebar) */
    onOpenCitations?: (num: string) => void
    /** Called when the "view PDF" action is triggered */
    onViewPdf?: (source: ChatCitationSource, citationNum: string) => void
}

// ─── Text → Citation Pills ───────────────────────────────────────────

/**
 * Scan a plain-text string for `⟦CITE_N⟧` markers (possibly grouped)
 * and replace each group with a `<span>` containing `<CitationPill>`s.
 *
 * @param text        Raw text string (from markdown AST)
 * @param sourcesMap  Map from citation number to source object
 * @param keyPrefix   React key prefix for stable reconciliation
 * @param callbacks   Click/view callbacks forwarded to the pill
 * @param extraProcessor  Optional post-processor for text segments (e.g., confidence badges)
 */
export function processTextWithCitations(
    text: string,
    sourcesMap: Map<string, ChatCitationSource>,
    keyPrefix: string = '',
    callbacks: CitationCallbacks = {},
    extraProcessor?: (nodes: React.ReactNode[], prefix: string) => React.ReactNode[],
    entriesMap?: Map<string, CitationEntry>,
): React.ReactNode[] {
    if (!text || typeof text !== 'string') return [text]

    const citationGroupRegex = /⟦CITE_\d+⟧(?:[\s,]*⟦CITE_\d+⟧)*/g
    const matches = Array.from(text.matchAll(citationGroupRegex))

    if (matches.length === 0) {
        const base = [text] as React.ReactNode[]
        return extraProcessor ? extraProcessor(base, keyPrefix) : base
    }

    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let groupCounter = 0

    for (const match of matches) {
        const matchIndex = match.index!

        // Text before this citation group
        if (matchIndex > lastIndex) {
            const before = text.slice(lastIndex, matchIndex)
            if (extraProcessor) {
                parts.push(...extraProcessor([before], `${keyPrefix}-before-${groupCounter}`))
            } else {
                parts.push(before)
            }
        }

        // Extract individual citation numbers from the group
        const matchString = match[0]
        const numRegex = /⟦CITE_(\d+)⟧/g
        const nums = Array.from(matchString.matchAll(numRegex)).map((m) => m[1])

        // Deduplicate by title (same document in a group → single pill)
        const uniqueSources = new Map<string, { num: string; source: ChatCitationSource | undefined }>()
        for (const num of nums) {
            const src = sourcesMap.get(num)
            const key = src?.title || `unknown-${num}`
            if (!uniqueSources.has(key)) {
                uniqueSources.set(key, { num, source: src })
            }
        }

        const pills = Array.from(uniqueSources.values()).map((item, idx) => {
            const entry = entriesMap?.get(item.num)
            return React.createElement(CitationPill, {
                key: `${keyPrefix}-citation-${groupCounter}-${idx}`,
                citationNum: item.num,
                source: item.source,
                onOpenCitations: callbacks.onOpenCitations
                    ? () => callbacks.onOpenCitations!(item.num)
                    : undefined,
                onViewPdf: callbacks.onViewPdf,
                citationType: entry?.type,
                confidence: entry?.confidence,
                metadata: entry?.metadata ? {
                    pageNumber: entry.metadata.pageNumber,
                    sectionHeading: entry.metadata.sectionHeading,
                } : undefined,
            })
        })

        parts.push(
            React.createElement(
                'span',
                {
                    key: `${keyPrefix}-group-${groupCounter++}`,
                    className: 'inline-flex items-center flex-wrap gap-1 mx-0.5',
                },
                ...pills,
            ),
        )

        lastIndex = matchIndex + matchString.length
    }

    // Text after the last citation group
    if (lastIndex < text.length) {
        const after = text.slice(lastIndex)
        if (extraProcessor) {
            parts.push(...extraProcessor([after], `${keyPrefix}-after-${groupCounter}`))
        } else {
            parts.push(after)
        }
    }

    const result = parts.length > 0 ? parts : [text]
    return extraProcessor ? extraProcessor(result, keyPrefix) : result
}

// ─── Node walker ─────────────────────────────────────────────────────

/**
 * Recursively walk a React node tree and replace citation markers in
 * text nodes with interactive `<CitationPill>` components.  Automatically
 * skips `<code>` / `<pre>` elements and already-rendered pills.
 */
export function processNodeForCitations(
    node: React.ReactNode,
    sourcesMap: Map<string, ChatCitationSource>,
    keyPrefix: string = '',
    callbacks: CitationCallbacks = {},
    extraProcessor?: (nodes: React.ReactNode[], prefix: string) => React.ReactNode[],
    depth: number = 0,
    isInCode: boolean = false,
    entriesMap?: Map<string, CitationEntry>,
): React.ReactNode {
    if (depth > 10) return node

    // Plain string → replace citations
    if (typeof node === 'string') {
        if (isInCode) return node
        const processed = processTextWithCitations(node, sourcesMap, keyPrefix, callbacks, extraProcessor, entriesMap)
        if (processed.length === 1 && processed[0] === node) return node
        return processed
    }

    // React element → recurse into children, but skip code
    if (React.isValidElement(node)) {
        const el = node as React.ReactElement<{ className?: string; children?: React.ReactNode }>
        if (el.type === CitationPill) return el

        const nodeType = el.type
        const className = typeof el.props?.className === 'string' ? el.props.className : ''
        const isCodeElement =
            typeof nodeType === 'string' &&
            (nodeType === 'code' ||
                nodeType === 'pre' ||
                className.includes('prose-code') ||
                className.includes('code') ||
                className.includes('language-'))

        if (isCodeElement) return el

        return React.cloneElement(
            el,
            { key: el.key || `${keyPrefix}-${depth}` },
            React.Children.map(el.props.children, (child, idx) =>
                processNodeForCitations(
                    child,
                    sourcesMap,
                    `${keyPrefix}-${idx}`,
                    callbacks,
                    extraProcessor,
                    depth + 1,
                    isInCode || isCodeElement,
                    entriesMap,
                ),
            ),
        )
    }

    // Array → recurse each item
    if (Array.isArray(node)) {
        return node.map((item, idx) =>
            processNodeForCitations(item, sourcesMap, `${keyPrefix}-${idx}`, callbacks, extraProcessor, depth, isInCode, entriesMap),
        )
    }

    return node
}
