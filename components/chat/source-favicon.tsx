"use client"

import * as React from "react"
import { FileText } from "lucide-react"
import Image from "next/image"
import { isDocumentSource, getFaviconUrl } from "@/lib/citations"

export function SourceFavicon({
    url,
    size,
    className,
}: {
    url: string
    size: number
    className?: string
}) {
    const [failed, setFailed] = React.useState(false)
    const isDocument = isDocumentSource(url)

    // If it's a project document, always use the FileText icon instead of fetching a favicon
    if (isDocument) {
        const sizeClasses: Record<number, string> = {
            14: "h-3.5 w-3.5",
            16: "h-4 w-4",
            20: "h-5 w-5",
            32: "h-8 w-8",
            64: "h-16 w-16"
        }
        const sizeClass = sizeClasses[size] || "h-5 w-5"
        return (
            <div className={`flex items-center justify-center bg-primary/5 rounded-sm overflow-hidden shrink-0 ${sizeClass} ${className || ""}`}>
                <FileText className="h-[75%] w-[75%] text-primary/70" />
            </div>
        )
    }

    const src = getFaviconUrl(url, size)

    // Map common sizes to Tailwind classes to avoid inline styles
    const sizeClasses: Record<number, string> = {
        14: "h-3.5 w-3.5",
        20: "h-5 w-5",
        32: "h-8 w-8",
        64: "h-16 w-16"
    }

    const sizeClass = sizeClasses[size] || `h-[${size}px] w-[${size}px]`
    const style = sizeClasses[size] ? undefined : { width: size, height: size }

    if (!src || failed) {
        return React.createElement('div', {
            className: `flex items-center justify-center bg-primary/5 shrink-0 ${sizeClass} ${className || ""}`,
            style: style,
            'aria-hidden': "true"
        }, React.createElement(FileText, { className: "h-full w-full p-0.5 text-primary/40" }))
    }

    return (
        <Image
            src={src}
            alt=""
            width={size}
            height={size}
            className={className}
            unoptimized // Using unoptimized because favicons come from diverse external domains
            onError={() => setFailed(true)}
        />
    )
}
