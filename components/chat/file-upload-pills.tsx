"use client"

import * as React from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { FileIcon } from "@/components/documents/file-icon"
import type { Attachment } from "@/types"

interface FileUploadPillsProps {
    files: Attachment[]
    onRemove: (fileName: string) => void
    onPreview: (attachment: Attachment) => void
}

export function FileUploadPills({ files, onRemove, onPreview }: FileUploadPillsProps) {
    if (files.length === 0) return null

    return (
        <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/5">
            {files.map((file, idx) =>
                file.type === 'image' && file.url ? (
                    <div
                        key={idx}
                        onClick={() => onPreview(file)}
                        className="relative group rounded-xl border bg-background/50 hover:border-primary/30 transition-all duration-200 cursor-pointer overflow-hidden h-16 w-16"
                    >
                        <Image
                            src={file.url}
                            alt="Pasted image"
                            fill
                            className="object-cover"
                            unoptimized
                        />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemove(file.name)
                            }}
                            aria-label="Remove image"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ) : (
                    <div
                        key={idx}
                        onClick={() => onPreview(file)}
                        className="relative group flex items-center gap-2.5 p-2 pr-3 rounded-xl border bg-background/50 hover:bg-background hover:border-primary/30 transition-all duration-200 min-w-[140px] max-w-[200px] cursor-pointer"
                    >
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center relative overflow-hidden">
                            <FileIcon filename={file.name} className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-medium truncate leading-none mb-1">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{file.type}</span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemove(file.name)
                            }}
                            aria-label={`Remove ${file.name}`}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )
            )}
        </div>
    )
}
