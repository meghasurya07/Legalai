"use client"

import * as React from "react"
import Image from "next/image"
import { Sparkles, FileText, Check } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { ConfidenceBadge, ConfidenceLevel } from "@/components/chat/confidence-badge"
import { SourceFavicon } from "@/components/chat/source-favicon"
import type { ActivityPhase } from "@/lib/ai/activity-constants"
import { getPhaseLabel } from "@/lib/ai/activity-constants"
import {
    ChatCitationSource,
    parseCitationIndex,
    stripSourcesBlock,
    stripCitationIndexBlock,
    escapeCitationMarkers,
    isDocumentSource,
    getCitationSourceDisplayName,
} from "@/lib/citations"
import {
    processTextWithCitations as sharedProcessText,
    processNodeForCitations as sharedProcessNode,
} from "@/lib/citation-processing"
import { parseCalendarAction, CalendarActionCard } from "@/components/chat/calendar-action-card"
import { WebResearchPanel } from "@/components/chat/web-research-panel"
import type { Attachment, Message, WebResearchStatus } from "@/types"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MessageBubbleProps {
    msg: Message
    index: number
    isLastMessage: boolean
    activityPhase: ActivityPhase
    thinkingDuration: number | null
    isThinking: boolean
    liveWebResearchStatus?: WebResearchStatus | null
    conversationId?: string | null
    onOpenCitations: (index: number) => void
    onOpenPdfViewer: (source: ChatCitationSource, citationNum: string) => void
    onPreviewAttachment: (attachment: Attachment) => void
    onToggleActivitySidebar: () => void
    currentVerb?: string
}

export function MessageBubble({
    msg,
    index: i,
    isLastMessage,
    activityPhase,
    thinkingDuration,
    isThinking,
    liveWebResearchStatus,
    conversationId,
    onOpenCitations,
    onOpenPdfViewer,
    onPreviewAttachment,
    onToggleActivitySidebar,
    currentVerb,
}: MessageBubbleProps) {
    return (
        <React.Fragment>
            {/* ChatGPT-style "Thinking" / "Thought for Xs" clickable header */}
            {/* Live state (during streaming) */}
            {msg.role === 'assistant' && (activityPhase || thinkingDuration) && isLastMessage && (
                <div className="mb-1 px-2 md:px-8 ml-0 md:ml-12">
                    <button
                        type="button"
                        onClick={onToggleActivitySidebar}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                    >
                        <div className="flex flex-col">
                            <span className="font-medium">
                                {thinkingDuration
                                    ? (isThinking ? `Thought for ${thinkingDuration}s` : `Searched for ${thinkingDuration}s`)
                                    : getPhaseLabel(activityPhase || 'thinking')
                                }
                            </span>
                            {/* Rotating verb sub-label */}
                            {!thinkingDuration && currentVerb && (
                                <span className="text-[11px] text-muted-foreground/60 font-medium activity-verb-rotate">
                                    {currentVerb}
                                </span>
                            )}
                        </div>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        {!thinkingDuration && <span className="inline-block w-1 h-1 rounded-full bg-current animate-pulse" />}
                    </button>
                </div>
            )}
            {/* Persisted state (after page refresh) — show from stored metadata */}
            {msg.role === 'assistant' && !activityPhase && !thinkingDuration && msg.activityMetadata && (
                <div className="mb-1 px-2 md:px-8 ml-0 md:ml-12">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="font-medium">
                            {msg.activityMetadata.mode === 'web_search' || msg.activityMetadata.mode === 'deep_research'
                                ? `Searched for ${msg.activityMetadata.duration}s`
                                : msg.activityMetadata.mode === 'thinking'
                                    ? `Thought for ${msg.activityMetadata.duration}s`
                                    : `Analyzed for ${msg.activityMetadata.duration}s`
                            }
                        </span>
                    </div>
                </div>
            )}
            <div className={`flex gap-2 md:gap-4 ${msg.role === 'user' ? 'justify-end px-2 md:px-12' : 'justify-start px-2 md:px-8'}`}>
                {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full border border-border/40 bg-card shadow-sm flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                )}
                <div className={`max-w-[95%] md:max-w-[85%] min-w-0 space-y-3 ${msg.role === 'user' ? 'bg-card border border-border/40 text-foreground px-3 py-2.5 md:px-5 md:py-3.5 rounded-2xl shadow-sm text-[15px]' : 'text-[15px] pt-1'}`}>
                    {/* Attached file pills */}
                    {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {msg.files.map((file: Attachment, idx: number) => (
                                file.type === 'image' && file.url ? (
                                    <div
                                        key={idx}
                                        className={`rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative w-[120px] h-[80px] ${msg.role === 'user' ? 'border border-white/20' : 'border border-border'}`}
                                        onClick={() => onPreviewAttachment(file)}
                                    >
                                        <Image
                                            src={file.url}
                                            alt="Attached image"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                ) : (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-black/10 transition-colors ${msg.role === 'user' ? 'bg-white/10 border-white/20' : 'bg-muted border-border'}`}
                                        onClick={() => onPreviewAttachment(file)}
                                    >
                                        <FileText className="h-4 w-4" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-medium truncate max-w-[150px]">{file.name}</span>
                                            <span className="text-[10px] opacity-70 uppercase">{file.type}</span>
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                    {/* Message content */}
                    {msg.role === 'user' ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                    ) : (
                        <>
                            {(msg.webResearch || (isLastMessage && liveWebResearchStatus)) && (
                                <WebResearchPanel status={msg.webResearch || liveWebResearchStatus!} className="mb-3" />
                            )}
                            <AssistantContent
                                content={msg.content}
                                messageId={msg.id}
                                conversationId={conversationId || undefined}
                                messageIndex={i}
                                onOpenCitations={onOpenCitations}
                                onOpenPdfViewer={onOpenPdfViewer}
                            />
                        </>
                    )}
                </div>
            </div>
        </React.Fragment>
    )
}

// ─── Assistant Content with Citations ────────────────────────────

interface AssistantContentProps {
    content: string
    messageId?: string
    conversationId?: string
    messageIndex: number
    onOpenCitations: (index: number) => void
    onOpenPdfViewer: (source: ChatCitationSource, citationNum: string) => void
}

function AssistantContent({ content, messageId, conversationId, messageIndex: i, onOpenCitations, onOpenPdfViewer }: AssistantContentProps) {
    // Parse citations using dual-format parser (handles both new JSON and legacy SOURCES)
    const citationIndex = parseCitationIndex(content)
    // Convert CitationEntry[] to ChatCitationSource[] for backward compat with CitationPill
    const sources: ChatCitationSource[] = citationIndex.entries.map(e => ({
        num: String(e.num),
        title: e.title,
        url: e.url,
        snippet: e.snippet,
    }))
    // Parse and strip calendar action blocks
    const { cleanMessage: contentNoCalendar, calendarItems, alreadyAdded } = parseCalendarAction(content)
    const [calendarDismissed, setCalendarDismissed] = React.useState(false)
    // Strip all draft markers from visible content (both old and new format)
    const contentNoDraft = contentNoCalendar
        .replace(/<!--DRAFT_CONTENT:[\s\S]*?-->/g, '')
        .replace(/<!--DRAFT_OPENED-->/g, '')
        .replace(/<!--DRAFT_START:[\s\S]*?-->[\s\S]*?(<!--DRAFT_END-->|$)/g, '')
        .replace(/<!--DRAFT_START:[\s\S]*?-->/g, '')
        .replace(/<!--DRAFT_END-->/g, '')
        .trim()
    // Strip both citation formats for display
    const displayContent = escapeCitationMarkers(stripCitationIndexBlock(stripSourcesBlock(contentNoDraft)))
    const sourcesMap = new Map(sources.map((src) => [src.num, src]))
    // Build entriesMap for passing type/confidence/metadata to CitationPills
    const entriesMap = new Map(citationIndex.entries.map(e => [String(e.num), e]))

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

    const callbacks = {
        onOpenCitations: () => onOpenCitations(i),
        onViewPdf: onOpenPdfViewer,
    }

    const processTextWithCitations = (text: string, keyPrefix: string = ''): React.ReactNode[] =>
        sharedProcessText(text, sourcesMap, keyPrefix, callbacks, processConfidenceBadges, entriesMap)

    const processNodeForCitations = (node: React.ReactNode, keyPrefix: string = '', depth: number = 0, isInCode: boolean = false): React.ReactNode =>
        sharedProcessNode(node, sourcesMap, keyPrefix, callbacks, processConfidenceBadges, depth, isInCode, entriesMap)

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
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none ml-1">
                            {sources.slice(0, 6).map((src) => {
                                const isDoc = isDocumentSource(src.url)
                                const displayName = getCitationSourceDisplayName(src.url, src.title)
                                return (
                                    <button
                                        key={src.num}
                                        type="button"
                                        onClick={() => {
                                            if (isDoc && onOpenPdfViewer) {
                                                onOpenPdfViewer(src, src.num)
                                            } else if (!isDoc) {
                                                window.open(src.url, '_blank', 'noopener,noreferrer')
                                            } else {
                                                onOpenCitations(i)
                                            }
                                        }}
                                        className="cite-pill-interactive shrink-0 flex flex-col items-start gap-1 p-2 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/50 text-xs text-muted-foreground hover:text-foreground transition-colors w-[160px] text-left"
                                    >
                                        {/* Row 1: Icon/Favicon + Source name + Badge */}
                                        <div className="flex items-center gap-1.5 w-full min-w-0">
                                            <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-sm shrink-0 bg-muted">
                                                {isDoc ? (
                                                    <FileText className="h-3 w-3 text-blue-500" />
                                                ) : (
                                                    <SourceFavicon url={src.url} size={16} className="h-4 w-4 object-cover" />
                                                )}
                                            </span>
                                            <span className="truncate font-semibold text-[11px] flex-1 text-foreground">
                                                {displayName}
                                            </span>
                                            <span className="shrink-0 text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full leading-none">
                                                {src.num}
                                            </span>
                                        </div>
                                        {/* Row 2: Snippet preview */}
                                        {src.snippet && (
                                            <p className="text-[10px] text-muted-foreground/75 truncate w-full leading-normal">
                                                {src.snippet}
                                            </p>
                                        )}
                                    </button>
                                )
                            })}
                            {sources.length > 6 && (
                                <button
                                    type="button"
                                    onClick={() => onOpenCitations(i)}
                                    className="shrink-0 px-2 py-1.5 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/50 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                                >
                                    +{sources.length - 6} more
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* Calendar Action Card — active */}
            {calendarItems && calendarItems.length > 0 && !calendarDismissed && (
                <CalendarActionCard
                    items={calendarItems}
                    onDismiss={() => {
                        setCalendarDismissed(true)
                        // Replace with CALENDAR_ADDED marker on dismiss
                        if (messageId && conversationId && content) {
                            const updatedContent = content.replace(/<!--CALENDAR_ACTION:[\s\S]*?-->/g, "<!--CALENDAR_ADDED-->").trim()
                            fetch(`/api/chat/conversations/${conversationId}/messages`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ messageId, content: updatedContent }),
                            }).catch(() => { /* silent */ })
                        }
                    }}
                    messageId={messageId}
                    conversationId={conversationId}
                    rawContent={content}
                />
            )}
            {/* Calendar Added badge — shown on reload after items were added */}
            {alreadyAdded && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 rounded-lg px-3 py-2 mt-2">
                    <Check className="h-3.5 w-3.5" />
                    <span>Added to your calendar</span>
                </div>
            )}
        </>
    )
}
