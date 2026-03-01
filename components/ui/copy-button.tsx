"use client"

import * as React from "react"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface CopyButtonProps {
    /** The raw markdown/display content to copy as plain text */
    displayContent: string
    /** A data attribute selector to find the rendered HTML element */
    msgSelector: string
}

/**
 * Copy button for AI messages — copies as both rich HTML and formatted plain text.
 */
export function CopyButton({ displayContent, msgSelector }: CopyButtonProps) {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = () => {
        const proseEl = document.querySelector(msgSelector)
        const htmlContent = proseEl ? proseEl.innerHTML : displayContent

        // Convert markdown to clean plain text with formatting
        const plainText = displayContent
            .replace(/^### (.+)$/gm, '\n$1\n')
            .replace(/^## (.+)$/gm, '\n$1\n' + '─'.repeat(30))
            .replace(/^# (.+)$/gm, '\n$1\n' + '═'.repeat(30))
            .replace(/^\* (.+)$/gm, '  • $1')
            .replace(/^- (.+)$/gm, '  • $1')
            .replace(/^\d+\. (.+)$/gm, (_match: string, p1: string, offset: number, str: string) => {
                const lines = str.substring(0, offset).split('\n')
                let num = 1
                for (let j = lines.length - 1; j >= 0; j--) {
                    if (/^\d+\. /.test(lines[j])) num++
                    else break
                }
                return `  ${num}. ${p1}`
            })
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/^> (.+)$/gm, '  │ $1')
            .replace(/\n{3,}/g, '\n\n')
            .trim()

        try {
            const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
            const textBlob = new Blob([plainText], { type: 'text/plain' })
            navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                })
            ]).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
                toast.success('Copied to clipboard')
            }).catch(() => {
                navigator.clipboard.writeText(plainText)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
                toast.success('Copied to clipboard')
            })
        } catch {
            navigator.clipboard.writeText(plainText)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast.success('Copied to clipboard')
        }
    }

    return (
        <button
            onClick={handleCopy}
            className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    )
}
