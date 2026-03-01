import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatCitationSource, CitationPill, SourceFavicon } from '@/components/chat-interface';

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    const [openCitationMatch, setOpenCitationMatch] = useState<string | null>(null);

    const openCitations = (id: string) => {
        setOpenCitationMatch(openCitationMatch === id ? null : id);
    };

    const sourcesMatch = content.match(/<!--SOURCES:?\s*([\s\S]*?)(?:-->|$)/i);
    const rawDisplayContent = content
        .replace(/<!--SOURCES:?[\s\S]*?-->/gi, '')
        .replace(/<!--S(?:O(?:U(?:R(?:C(?:E(?:S)?)?)?)?)?)?[\s\S]*$/i, '')
        .replace(/<!--\s*$/i, '')
        .trim();

    const displayContent = rawDisplayContent.replace(/\[\s*(\d+)\s*\]/g, '⟦CITE_$1⟧');

    const sources: ChatCitationSource[] = sourcesMatch ? sourcesMatch[1].trim().split('\n').map((line: string) => {
        const match = line.match(/\[(\d+)\]\s*([^|]+)(?:\s*\|\s*([^|]*?))?(?:\s*\|\s*(.*))?$/);
        if (!match) return null;

        let url = (match[3] || '').trim();
        if (url && !url.startsWith('http') && !url.includes('.')) {
            url = '';
        }

        return {
            num: match[1],
            title: match[2].trim(),
            url: url || 'https://legal-source.internal',
            snippet: (match[4] || '').trim()
        } as ChatCitationSource;
    }).filter((x): x is ChatCitationSource => x !== null) : [];

    const sourcesMap = new Map(sources.map((src) => [src.num, src]));

    const processTextWithCitations = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
        if (!text || typeof text !== 'string') return [text];
        const citationRegex = /⟦CITE_(\d+)⟧/g;
        const matches = Array.from(text.matchAll(citationRegex));

        if (matches.length === 0) return [text];

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let keyCounter = 0;

        for (const match of matches) {
            const matchIndex = match.index!;
            if (matchIndex > lastIndex) {
                parts.push(text.slice(lastIndex, matchIndex));
            }
            parts.push(
                <CitationPill
                    key={`${keyPrefix}-citation-${keyCounter++}-${matchIndex}`}
                    citationNum={match[1]}
                    source={sourcesMap.get(match[1])}
                    onOpenCitations={() => openCitations(match[1])}
                />
            );
            lastIndex = matchIndex + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }
        return parts.length > 0 ? parts : [text];
    };

    const processNodeForCitations = (node: React.ReactNode, keyPrefix: string = '', depth: number = 0, isInCode: boolean = false): React.ReactNode => {
        if (depth > 10) return node;
        if (typeof node === 'string') {
            if (isInCode) return node;
            const processed = processTextWithCitations(node, keyPrefix);
            if (processed.length === 1 && processed[0] === node) return node;
            return processed;
        }
        if (React.isValidElement(node)) {
            const el = node as React.ReactElement<Record<string, unknown>>;
            if (el.type === CitationPill) return el;

            const nodeType = el.type;
            const className = typeof el.props?.className === "string" ? el.props.className : "";
            const isCodeElement = typeof nodeType === 'string' && (
                nodeType === 'code' || nodeType === 'pre' || className.includes('prose-code') || className.includes('code') || className.includes('language-')
            );

            if (isCodeElement) return el;

            return React.cloneElement(
                el,
                { key: el.key || `${keyPrefix}-${depth}` },
                React.Children.map(el.props.children, (child, idx) =>
                    processNodeForCitations(child as React.ReactNode, `${keyPrefix}-${idx}`, depth + 1, isInCode || isCodeElement)
                )
            );
        }
        if (Array.isArray(node)) {
            return node.map((item, idx) => processNodeForCitations(item, `${keyPrefix}-${idx}`, depth, isInCode));
        }
        return node;
    };

    const markdownComponents: Record<string, React.ElementType> = {
        text: ({ children }) => {
            if (typeof children === 'string') {
                const processed = processTextWithCitations(children, `text`);
                return <>{processed}</>;
            }
            return <>{children}</>;
        },
        code: ({ children, ...props }) => <code {...props}>{children}</code>,
        pre: ({ children, ...props }) => <pre {...props}>{children}</pre>,
        p: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNodeForCitations(child, `p`, 0));
            return <p className="leading-7 whitespace-pre-wrap" {...props}>{processed}</p>;
        },
        ul: ({ children, ...props }) => <ul className="list-disc pl-6 my-3 space-y-2" {...props}>{children}</ul>,
        ol: ({ children, ...props }) => <ol className="list-decimal pl-6 my-3 space-y-2" {...props}>{children}</ol>,
        li: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNodeForCitations(child, `li`, 0));
            return React.createElement('li', { className: "my-0 leading-7", ...props }, processed);
        },
        strong: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNodeForCitations(child, `strong`, 0));
            return <strong {...props}>{processed}</strong>;
        },
        em: ({ children, ...props }) => {
            const processed = React.Children.map(children, (child) => processNodeForCitations(child, `em`, 0));
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
            const processed = React.Children.map(children, (child) => processNodeForCitations(child, `td`, 0));
            return <td className="px-4 py-3 align-top leading-relaxed" {...props}>{processed}</td>;
        }
    };

    return (
        <div className="w-full">
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-headings:mt-6 prose-headings:mb-3 prose-headings:font-semibold prose-h2:text-lg prose-h3:text-base prose-ul:my-3 prose-ul:space-y-1 prose-ol:my-3 prose-ol:space-y-1 prose-li:my-0 prose-li:leading-7 prose-pre:my-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-blockquote:my-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none">
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
