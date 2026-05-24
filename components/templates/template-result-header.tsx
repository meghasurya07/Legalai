"use client"

import * as React from "react"
import { Copy, Check, Download, Printer, RotateCcw, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface TemplateResultHeaderProps {
    /** Title shown in the header */
    title: string
    /** Icon to display */
    icon?: React.ReactNode
    /** Accent color class for the icon container */
    accentColor?: string
    /** When the result was generated */
    generatedAt?: Date
    /** Callback to reset/start new analysis */
    onReset: () => void
    /** Label for the reset button */
    resetLabel?: string
    /** Data to copy as markdown text */
    copyContent?: string
    /** Data to download as text file */
    downloadContent?: string
    /** Download filename */
    downloadFilename?: string
    /** Extra actions to render */
    children?: React.ReactNode
}

export function TemplateResultHeader({
    title,
    icon,
    accentColor,
    generatedAt,
    onReset,
    resetLabel = "New Analysis",
    copyContent,
    downloadContent,
    downloadFilename = "analysis.txt",
    children,
}: TemplateResultHeaderProps) {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = async () => {
        if (!copyContent) return
        try {
            await navigator.clipboard.writeText(copyContent)
            setCopied(true)
            toast.success("Copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy")
        }
    }

    const handleDownload = () => {
        if (!downloadContent) return
        const blob = new Blob([downloadContent], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = downloadFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`Downloaded ${downloadFilename}`)
    }

    const handlePrint = () => {
        window.print()
    }

    const formattedTime = generatedAt
        ? new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(generatedAt)
        : null

    return (
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5 bg-background/80 backdrop-blur-md border-b border-border/50 print:static print:bg-transparent print:border-0">
            <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
                {/* Left: Title + Timestamp */}
                <div className="flex items-center gap-2.5 min-w-0">
                    {icon && (
                        <div
                            className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${accentColor || "bg-primary/10 text-primary"}`}
                        >
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold truncate">{title}</h2>
                        {formattedTime && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Generated {formattedTime}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                    {children}

                    <TooltipProvider delayDuration={300}>
                        {copyContent && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleCopy}
                                    >
                                        {copied ? (
                                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy All</TooltipContent>
                            </Tooltip>
                        )}

                        {downloadContent && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleDownload}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handlePrint}
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Print</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="w-px h-5 bg-border mx-1" />

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={onReset}
                    >
                        <RotateCcw className="h-3 w-3" />
                        {resetLabel}
                    </Button>
                </div>
            </div>
        </div>
    )
}
