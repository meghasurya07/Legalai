"use client"

import * as React from "react"
import Image from "next/image"
import { Sparkles, FileText } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { ConfidenceBadge, ConfidenceLevel } from "@/components/chat/confidence-badge"
import { CitationPill } from "@/components/chat/citation-pill"
import { SourceFavicon } from "@/components/chat/source-favicon"
import type { ActivityPhase } from "@/components/chat/activity-timeline"
import {
    ChatCitationSource,
    parseSources,
    stripSourcesBlock,
    escapeCitationMarkers,
} from "@/lib/citations"
import type { Attachment, Message } from "@/types"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MessageBubbleProps {
    msg: Message
    index: number
    isLastMessage: boolean
    activityPhase: ActivityPhase
    thinkingDuration: number | null
    isThinking: boolean
    onOpenCitations: (index: number) => void
    onOpenPdfViewer: (source: ChatCitationSource, citationNum: string) => void
    onPreviewAttachment: (attachment: Attachment) => void
    onToggleActivitySidebar: () => void
}

export function MessageBubble({
    msg,
    index: i,
    isLastMessage,
    activityPhase,
    thinkingDuration,
    isThinking,
    onOpenCitations,
    onOpenPdfViewer,
    onPreviewAttachment,
    onToggleActivitySidebar,
}: MessageBubbleProps) {
    return (
        <React.Fragment>
            {/* ChatGPT-style "Thinking" / "Thought for Xs" clickable header */}
            {msg.role === 'assistant' && (activityPhase || thinkingDuration) && isLastMessage && (
                <div className="mb-1 px-2 md:px-8 ml-12">
                    <button
                        type="button"
                        onClick={onToggleActivitySidebar}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                    >
                        <span className="font-medium">
                            {thinkingDuration
                                ? (isThinking ? `Thought for ${thinkingDuration}s` : `Searched for ${thinkingDuration}s`)
                                : activityPhase === 'searching_web' ? 'Searching the web'
                                    : activityPhase === 'thinking' ? 'Thinking'
                                        : activityPhase === 'drafting' ? 'Writing'
                                            : 'Processing'
                            }
                        </span>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        {!thinkingDuration && <span className="inline-block w-1 h-1 rounded-full bg-current animate-pulse" />}
                    </button>
                </div>
            )}
            <div className={`flex gap-4 ${msg.role === 'user' ? 'justify-end px-4 md:px-12' : 'justify-start px-2 md:px-8'}`}>
                {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full border border-border/40 bg-card shadow-sm flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                )}
                <div className={`max-w-[85%] min-w-0 space-y-3 ${msg.role === 'user' ? 'bg-card border border-border/40 text-foreground px-5 py-3.5 rounded-2xl shadow-sm text-[15px]' : 'text-[15px] pt-1'}`}>
                    {/* Attached file pills */}
                    {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {msg.files.map((file: Attachment, idx: number) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-black/10 transition-colors ${msg.role === 'user' ? 'bg-white/10 border-white/20' : 'bg-muted border-border'}`}
                                    onClick={() => onPreviewAttachment(file)}
                                >
                                    {file.type === 'image' ? (
                                        <div className="h-8 w-8 rounded overflow-hidden bg-white/20 flex-shrink-0 relative">
                                            {file.url ? (
                                                <Image
                                                    src={file.url}
                                                    alt={file.name || "Preview"}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            ) : <FileText />}
                                        </div>
                                    ) : (
                                        <FileText className="h-4 w-4" />
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-medium truncate max-w-[150px]">{file.name}</span>
                                        <span className="text-[10px] opacity-70 uppercase">{file.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Message content */}
                    {msg.role === 'user' ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                    ) : (
                        <AssistantContent
                            content={msg.content}
                            messageIndex={i}
                            onOpenCitations={onOpenCitations}
                            onOpenPdfViewer={onOpenPdfViewer}
                        />
                    )}
                </div>
            </div>
        </React.Fragment>
    )
}

// ─── Assistant Content with Citations ────────────────────────────

interface AssistantContentProps {
    content: string
    messageIndex: number
    onOpenCitations: (index: number) => void
    onOpenPdfViewer: (source: ChatCitationSource, citationNum: string) => void
}

function AssistantContent({ content, messageIndex: i, onOpenCitations, onOpenPdfViewer }: AssistantContentProps) {
    const sources = parseSources(content)
    const displayContent = escapeCitationMarkers(stripSourcesBlock(content))
    const sourcesMap = new Map(sources.map((src) => [src.num, src]))

    const processConfidenceBadges = (nodes: React.ReactNode[], keyPrefix: string): React.ReactNode[] => {
        const result: React.ReactNode[] = []
        let keyCounter = 0
        for (const node of nodes) {
            if (typeof node === 'string') {
                const confRegex = /\[CONF_(HIGH|MEDIUM|LOW)\]/g
                const matches = Array.from(node.matchAll(confRegex))
                if (matches.length === 0) {
                    result.push(node)
                    continue
                }
                let lastIndex = 0
                for (const match of matches) {
                    const matchIndex = match.index!
                    if (matchIndex > lastIndex) result.push(node.slice(lastIndex, matchIndex))
                    result.push(<ConfidenceBadge key={`${keyPrefix}-conf-${keyCounter++}-${matchIndex}`} level={match[1] as ConfidenceLevel} />)
                    lastIndex = matchIndex + match[0].length
                }
                if (lastIndex < node.length) result.push(node.slice(lastIndex))
            } else {
                result.push(node)
            }
        }
        return result
    }

    const processTextWithCitations = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
        if (!text || typeof text !== 'string') return [text]
        const citationGroupRegex = /⟦CITE_\d+⟧(?:[\s,]*⟦CITE_\d+⟧)*/g
        const matches = Array.from(text.matchAll(citationGroupRegex))
        const parts: React.ReactNode[] = []
        let lastIndex = 0
        let groupCounter = 0

        for (const match of matches) {
            const matchIndex = match.index!
            if (matchIndex > lastIndex) {
                const beforeText = text.slice(lastIndex, matchIndex)
                parts.push(...(processConfidenceBadges([beforeText], `${keyPrefix}-before-${groupCounter}`) as React.ReactNode[]))
            }

            const matchString = match[0]
            const numRegex = /⟦CITE_(\d+)⟧/g
            const nums = Array.from(matchString.matchAll(numRegex)).map(m => m[1])

            const uniqueSources = new Map<string, { num: string, source: ChatCitationSource | undefined }>()
            for (const num of nums) {
                const src = sourcesMap.get(num)
                const key = src?.title || `unknown-${num}`
                if (!uniqueSources.has(key)) {
                    uniqueSources.set(key, { num, source: src })
                }
            }

            const pills = Array.from(uniqueSources.values()).map((item, idx) => (
                <CitationPill
                    key={`${keyPrefix}-citation-${groupCounter}-${idx}`}
                    citationNum={item.num}
                    source={item.source}
                    onOpenCitations={() => onOpenCitations(i)}
                    onViewPdf={onOpenPdfViewer}
                />
            ))

            parts.push(
                <span key={`${keyPrefix}-group-${groupCounter++}`} className="inline-flex items-center flex-wrap gap-1 mx-0.5">
                    {pills}
                </span>
            )

            lastIndex = matchIndex + matchString.length
        }
        if (lastIndex < text.length) {
            const afterText = text.slice(lastIndex)
            parts.push(...(processConfidenceBadges([afterText], `${keyPrefix}-after-${groupCounter}`) as React.ReactNode[]))
        }
        return processConfidenceBadges(parts.length > 0 ? parts : [text], keyPrefix)
    }

    const processNodeForCitations = (node: React.ReactNode, keyPrefix: string = '', depth: number = 0, isInCode: boolean = false): React.ReactNode => {
        if (depth > 10) return node
        if (typeof node === 'string') {
            if (isInCode) return node
            const processed = processTextWithCitations(node, keyPrefix)
            if (processed.length === 1 && processed[0] === node) return node
            return processed
        }
        if (React.isValidElement(node)) {
            const el = node as React.ReactElement<{ className?: string; children?: React.ReactNode }>
            if (el.type === CitationPill) return el
            const nodeType = el.type
            const className = typeof el.props?.className === "string" ? el.props.className : ""
            const isCodeElement = typeof nodeType === 'string' && (nodeType === 'code' || nodeType === 'pre' || className.includes('prose-code') || className.includes('code') || className.includes('language-'))
            if (isCodeElement) return el
            return React.cloneElement(el, { key: el.key || `${keyPrefix}-${depth}` }, React.Children.map(el.props.children, (child, idx) => processNodeForCitations(child, `${keyPrefix}-${idx}`, depth + 1, isInCode || isCodeElement)))
        }
        if (Array.isArray(node)) return node.map((item, idx) => processNodeForCitations(item, `${keyPrefix}-${idx}`, depth, isInCode))
        return node
    }

    const processCitations = (children: React.ReactNode, prefix: string) =>
        React.Children.map(children, (child) => processNodeForCitations(child, `${prefix}-${i}`, 0))

    const markdownComponents: Record<string, React.ElementType> = {
        text: ({ children }: { children?: React.ReactNode }) => typeof children === 'string' ? <>{processTextWithCitations(children, `text-${i}`)}</> : <>{children}</>,
        code: ({ children, ...props }: { children?: React.ReactNode }) => <code {...props}>{children}</code>,
        pre: ({ children, ...props }: { children?: React.ReactNode }) => <pre {...props}>{children}</pre>,
        p: ({ children, ...props }: { children?: React.ReactNode }) => <p className="my-3 leading-7" {...props}>{processCitations(children, 'p')}</p>,
        ul: ({ children, ...props }: { children?: React.ReactNode }) => <ul className="list-disc pl-6 my-3 space-y-2" {...props}>{children}</ul>,
        ol: ({ children, ...props }: { children?: React.ReactNode }) => <ol className="list-decimal pl-6 my-3 space-y-2" {...props}>{children}</ol>,
        li: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('li', { className: "my-0 leading-7", ...props }, processCitations(children, 'li')),
        strong: ({ children, ...props }: { children?: React.ReactNode }) => <strong {...props}>{processCitations(children, 'strong')}</strong>,
        em: ({ children, ...props }: { children?: React.ReactNode }) => <em {...props}>{processCitations(children, 'em')}</em>,
        blockquote: ({ children, ...props }: { children?: React.ReactNode }) => <blockquote {...props}>{processCitations(children, 'blockquote')}</blockquote>,
        h1: ({ children, ...props }: { children?: React.ReactNode }) => <h1 {...props}>{processCitations(children, 'h1')}</h1>,
        h2: ({ children, ...props }: { children?: React.ReactNode }) => <h2 {...props}>{processCitations(children, 'h2')}</h2>,
        h3: ({ children, ...props }: { children?: React.ReactNode }) => <h3 {...props}>{processCitations(children, 'h3')}</h3>,
        table: ({ children, ...props }: { children?: React.ReactNode }) => (<div className="my-4 w-full overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm text-left relative" {...props}>{children}</table></div>),
        thead: ({ children, ...props }: { children?: React.ReactNode }) => <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground border-b border-border" {...props}>{children}</thead>,
        tbody: ({ children, ...props }: { children?: React.ReactNode }) => <tbody className="divide-y divide-border/50 bg-background" {...props}>{children}</tbody>,
        tr: ({ children, ...props }: { children?: React.ReactNode }) => <tr className="hover:bg-muted/20 transition-colors" {...props}>{children}</tr>,
        th: ({ children, ...props }: { children?: React.ReactNode }) => <th className="px-4 py-3 font-medium whitespace-nowrap" {...props}>{children}</th>,
        td: ({ children, ...props }: { children?: React.ReactNode }) => <td className="px-4 py-3 align-top leading-relaxed" {...props}>{processCitations(children, 'td')}</td>,
    }

    return (
        <>
            <div data-msg-index={i} className="prose prose-sm dark:prose-invert max-w-none break-words overflow-x-auto prose-p:my-3 prose-p:leading-7 prose-headings:mt-6 prose-headings:mb-3 prose-headings:font-semibold prose-h2:text-lg prose-h3:text-base prose-ul:my-3 prose-ul:space-y-1 prose-ol:my-3 prose-ol:space-y-1 prose-li:my-0 prose-li:leading-7 prose-pre:my-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-blockquote:my-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-a:text-primary prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{displayContent || ''}</ReactMarkdown>
            </div>
            {content && (
                <div className="flex items-center gap-1 mt-3 -ml-1 relative">
                    <CopyButton displayContent={displayContent} msgSelector={`[data-msg-index="${i}"]`} />
                    {sources.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onOpenCitations(i)}
                            className="cursor-pointer inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
                        >
                            <span className="flex items-center -space-x-2">
                                {sources.slice(0, 3).map((src) => (
                                    <span
                                        key={src.num}
                                        className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-border bg-background"
                                    >
                                        <SourceFavicon url={src.url} size={20} className="h-5 w-5 object-cover" />
                                    </span>
                                ))}
                            </span>
                            <span className="font-medium">Sources</span>
                        </button>
                    )}
                </div>
            )}
        </>
    )
}
