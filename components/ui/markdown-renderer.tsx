import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SourceFavicon } from '@/components/chat/source-favicon';
import type { ChatCitationSource } from '@/lib/citations';
import {
    parseCitationIndex,
    stripSourcesBlock,
    stripCitationIndexBlock,
    escapeCitationMarkers,
} from '@/lib/citations';
import {
    processTextWithCitations as sharedProcessText,
    processNodeForCitations as sharedProcessNode,
} from '@/lib/citation-processing';

interface MarkdownRendererProps {
    content: string;
    onSourceClick?: (index: string) => void;
    onViewPdf?: (source: ChatCitationSource, citationNum: string) => void;
}

export function MarkdownRenderer({ content, onSourceClick, onViewPdf }: MarkdownRendererProps) {
    const [openCitationMatch, setOpenCitationMatch] = useState<string | null>(null);

    const openCitations = (id: string) => {
        setOpenCitationMatch(openCitationMatch === id ? null : id);
        if (onSourceClick) onSourceClick(id);
    };

    // Parse citations using dual-format parser (handles both new JSON and legacy SOURCES)
    const citationIndex = parseCitationIndex(content);
    const sources: ChatCitationSource[] = citationIndex.entries.map(e => ({
        num: String(e.num),
        title: e.title,
        url: e.url,
        snippet: e.snippet,
    }));
    const displayContent = escapeCitationMarkers(stripCitationIndexBlock(stripSourcesBlock(content)));
    const sourcesMap = new Map(sources.map((src) => [src.num, src]));

    const callbacks = {
        onOpenCitations: (num: string) => openCitations(num),
        onViewPdf,
    };

    const processText = (text: string, keyPrefix: string = '') =>
        sharedProcessText(text, sourcesMap, keyPrefix, callbacks);

    const processNode = (node: React.ReactNode, keyPrefix: string = '', depth = 0, isInCode = false) =>
        sharedProcessNode(node, sourcesMap, keyPrefix, callbacks, undefined, depth, isInCode);

    const markdownComponents: Record<string, React.ElementType> = {
        text: ({ children }) => {
            if (typeof children === 'string') {
                const processed = processText(children, `text`);
                return <>{processed}</>;
            }
            return <>{children}</>;
        },
        code: ({ children, ...props }) => <code {...props}>{children}</code>,
        pre: ({ children, ...props }) => <pre {...props}>{children}</pre>,
        p: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNode(child, `p`, 0));
            return <p className="leading-normal mb-2 last:mb-0" {...props}>{processed}</p>;
        },
        ul: ({ children, ...props }) => <ul className="list-disc pl-5 my-1.5 space-y-1" {...props}>{children}</ul>,
        ol: ({ children, ...props }) => <ol className="list-decimal pl-5 my-1.5 space-y-1" {...props}>{children}</ol>,
        li: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNode(child, `li`, 0));
            return React.createElement('li', { className: "my-0.5 leading-normal", ...props }, processed);
        },
        strong: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNode(child, `strong`, 0));
            return <strong {...props}>{processed}</strong>;
        },
        em: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNode(child, `em`, 0));
            return <em {...props}>{processed}</em>;
        },
        table: ({ children, ...props }) => (
            <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm text-left relative" {...props}>{children}</table>
            </div>
        ),
        thead: ({ children, ...props }) => <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground border-b border-border" {...props}>{children}</thead>,
        tbody: ({ children, ...props }) => <tbody className="divide-y divide-border/50 bg-background" {...props}>{children}</tbody>,
        tr: ({ children, ...props }) => <tr className="hover:bg-muted/20 transition-colors" {...props}>{children}</tr>,
        th: ({ children, ...props }) => <th className="px-4 py-3 font-medium whitespace-nowrap" {...props}>{children}</th>,
        td: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNode(child, `td`, 0));
            return <td className="px-4 py-3 align-top leading-relaxed" {...props}>{processed}</td>;
        }
    };

    return (
        <div className="w-full">
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-semibold prose-h2:text-base prose-h3:text-sm prose-ul:my-1.5 prose-ul:space-y-0.5 prose-ol:my-1.5 prose-ol:space-y-0.5 prose-li:my-0 prose-li:leading-normal prose-pre:my-2 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-blockquote:my-2 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-lg prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                >
                    {displayContent || ''}
                </ReactMarkdown>
            </div>
            {sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/50">
                    <button
                        type="button"
                        onClick={() => openCitations('sources')}
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
                        <span className="font-medium">{sources.length} sources</span>
                    </button>
                </div>
            )}
        </div>
    );
}
