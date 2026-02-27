"use client"

import * as React from "react"
import Image from "next/image"
import { FileText, Cloud, AlertTriangle, Sparkles } from "lucide-react"
import mammoth from "mammoth"
import Papa from "papaparse"
import DOMPurify from "dompurify"
import { Attachment } from "@/types"

interface FilePreviewContentProps {
    attachment: Attachment
}

export function FilePreviewContent({ attachment }: FilePreviewContentProps) {
    const [content, setContent] = React.useState<React.ReactNode | null>(null)
    const [loading, setLoading] = React.useState(false)

    React.useEffect(() => {
        const loadContent = async () => {
            if (!attachment.file && attachment.source === 'upload' && !attachment.url) return
            setLoading(true)

            try {
                if (attachment.source === 'drive') {
                    setContent(
                        <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                            <Cloud className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Drive File Preview</h3>
                            <p className="text-muted-foreground">Preview not available for remote Drive files yet.</p>
                            <p className="text-xs text-muted-foreground mt-2">({attachment.name})</p>
                        </div>
                    )
                } else if (attachment.type === 'docx' && (attachment.file || attachment.url)) {
                    let arrayBuffer: ArrayBuffer

                    if (attachment.file) {
                        arrayBuffer = await attachment.file.arrayBuffer()
                    } else {
                        const res = await fetch(attachment.url!)
                        if (!res.ok) {
                            throw new Error(`Failed to fetch file: ${res.status}`)
                        }
                        // Check content-type to avoid parsing HTML error pages as ZIP
                        const contentType = res.headers.get('content-type') || ''
                        if (contentType.includes('text/html') || contentType.includes('text/xml')) {
                            throw new Error('Received HTML/XML instead of document binary')
                        }
                        arrayBuffer = await res.arrayBuffer()
                        // Validate it looks like a ZIP (docx = zip with PK header)
                        const header = new Uint8Array(arrayBuffer.slice(0, 4))
                        if (header[0] !== 0x50 || header[1] !== 0x4B) {
                            throw new Error('File does not appear to be a valid .docx document')
                        }
                    }

                    const result = await mammoth.convertToHtml({ arrayBuffer })
                    const sanitizedHtml = DOMPurify.sanitize(result.value)
                    setContent(
                        <div className="prose prose-sm max-w-none p-8 dark:prose-invert bg-white dark:bg-neutral-900 min-h-full" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                    )
                } else if (attachment.type === 'csv' && (attachment.file || attachment.url)) {
                    const parseSource = attachment.file || attachment.url
                    if (parseSource) {
                        const config: Papa.ParseConfig<string[]> = {
                            complete: (results) => {
                                setContent(
                                    <div className="overflow-auto p-4">
                                        <table className="w-full text-sm border-collapse">
                                            <tbody>
                                                {results.data.slice(0, 100).map((row, i) => (
                                                    <tr key={i} className="border-b hover:bg-muted/50">
                                                        {(row as string[]).map((cell, j) => (
                                                            <td key={j} className="p-2 border-r last:border-r-0 max-w-[200px] truncate">{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {results.data.length > 100 && (
                                            <p className="text-xs text-muted-foreground mt-4 text-center">Showing first 100 rows</p>
                                        )}
                                    </div>
                                )
                            },
                            header: false
                        }

                        if (attachment.file) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            Papa.parse(attachment.file as any, config)
                        } else if (attachment.url) {
                            Papa.parse(attachment.url, {
                                ...config,
                                download: true
                            } as Papa.ParseConfig<string[]>)
                        }
                    }
                } else if (attachment.type === 'text' && attachment.file) {
                    const text = await attachment.file.text()
                    setContent(
                        <pre className="p-6 text-sm font-mono whitespace-pre-wrap overflow-auto h-full bg-muted/20 text-foreground">
                            {text}
                        </pre>
                    )
                } else if (attachment.type === 'text' && attachment.url) {
                    const res = await fetch(attachment.url)
                    const text = await res.text()
                    setContent(
                        <pre className="p-6 text-sm font-mono whitespace-pre-wrap overflow-auto h-full bg-muted/20 text-foreground">
                            {text}
                        </pre>
                    )
                } else if (attachment.type === 'image' && attachment.url) {
                    setContent(
                        <div className="relative w-full h-full flex items-center justify-center">
                            <Image
                                src={attachment.url}
                                alt={attachment.name}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    )
                } else if (attachment.type === 'pdf' && attachment.url) {
                    setContent(<iframe src={attachment.url} title="Document Preview" className="w-full h-full border-0 bg-white" />)
                } else {
                    setContent(
                        <div className="flex flex-col items-center gap-2 text-muted-foreground h-full justify-center">
                            <FileText className="h-12 w-12" />
                            <p>Preview not available for this file type</p>
                        </div>
                    )
                }
            } catch (error) {
                console.error("Preview error:", error)
                // Show extracted text as fallback if available
                if (attachment.extractedText) {
                    setContent(
                        <div className="p-6 h-full overflow-auto">
                            <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400 text-sm">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>Showing extracted text (document preview unavailable)</span>
                            </div>
                            <pre className="text-sm font-mono whitespace-pre-wrap text-foreground bg-muted/20 p-4 rounded-lg">
                                {attachment.extractedText}
                            </pre>
                        </div>
                    )
                } else {
                    setContent(
                        <div className="flex flex-col items-center gap-3 text-destructive h-full justify-center p-8">
                            <AlertTriangle className="h-12 w-12" />
                            <p className="font-medium">Failed to load preview</p>
                            <p className="text-xs text-muted-foreground text-center max-w-sm">
                                The file may have expired or is not in a supported format. Try re-uploading the document.
                            </p>
                        </div>
                    )
                }
            } finally {
                setLoading(false)
            }
        }

        loadContent()
    }, [attachment])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 min-h-[400px]">
                <Sparkles className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
        )
    }

    return <div className="h-full w-full">{content}</div>
}
