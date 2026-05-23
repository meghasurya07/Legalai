"use client"

import * as React from "react"
import Image from "next/image"
import { Paperclip, Globe, Wand2, UploadCloud, X, Cloud, Brain, Sparkles, Square, BookOpen, Scale, Briefcase, FileText, ShieldCheck, Search, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { ModeBadges } from "@/components/chat/mode-badges"
import { FileIcon } from "@/components/documents/file-icon"
import { toast } from "sonner"
import type { Attachment } from "@/types"

const SUPPORTED_CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
}

export function getSupportedClipboardImageExtension(mimeType: string): string | null {
    return SUPPORTED_CLIPBOARD_IMAGE_EXTENSIONS[mimeType] || null
}

function padTimestampPart(value: number): string {
    return String(value).padStart(2, '0')
}

export function getScreenshotFileName(mimeType: string, index = 0, date = new Date()): string {
    const extension = getSupportedClipboardImageExtension(mimeType) || 'png'
    const timestamp = [
        date.getFullYear(),
        padTimestampPart(date.getMonth() + 1),
        padTimestampPart(date.getDate()),
    ].join('')
    const time = [
        padTimestampPart(date.getHours()),
        padTimestampPart(date.getMinutes()),
        padTimestampPart(date.getSeconds()),
    ].join('')
    const suffix = index > 0 ? `-${index + 1}` : ''

    return `screenshot-${timestamp}-${time}${suffix}.${extension}`
}

export function createScreenshotFile(file: File, index = 0, date = new Date()): File {
    return new File([file], getScreenshotFileName(file.type, index, date), {
        type: file.type,
        lastModified: date.getTime(),
    })
}

interface ChatInputProps {
    inputValue: string
    onInputChange: (value: string) => void
    isLoading: boolean
    hasMessages: boolean
    uploadedFiles: Attachment[]
    onSend: () => void
    onStop: () => void
    onImprovePrompt: () => void
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    onPasteFiles: (files: File[]) => void
    onRemoveFile: (fileName: string) => void
    onPreviewAttachment: (attachment: Attachment) => void
    isImprovingPrompt: boolean
    isThinking: boolean
    isWebSearch: boolean
    isDeepResearch: boolean
    isConfidenceMode: boolean
    onThinkingChange: (v: boolean) => void
    onWebSearchChange: (v: boolean) => void
    onDeepResearchChange: (v: boolean) => void
    onConfidenceModeChange: (v: boolean) => void
    mode: "default" | "project"
    isFileDialogOpen: boolean
    onFileDialogChange: (open: boolean) => void
}

interface PromptItem {
    id: string
    title: string
    content: string
    description: string | null
    category: string
    type: string
}

function getCategoryMeta(category: string | null | undefined) {
    const cat = (category || "General").toLowerCase()
    if (cat.includes("corp") || cat.includes("m&a") || cat.includes("business")) {
        return {
            icon: Briefcase,
            color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
            label: "Corporate",
            theme: "amber"
        }
    }
    if (cat.includes("litig") || cat.includes("court") || cat.includes("gavel")) {
        return {
            icon: Scale,
            color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
            label: "Litigation",
            theme: "rose"
        }
    }
    if (cat.includes("compliance") || cat.includes("risk") || cat.includes("regulatory")) {
        return {
            icon: ShieldCheck,
            color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
            label: "Compliance",
            theme: "emerald"
        }
    }
    if (cat.includes("nda") || cat.includes("contract") || cat.includes("agree")) {
        return {
            icon: FileText,
            color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
            label: "Contracts",
            theme: "blue"
        }
    }
    return {
        icon: Sparkles,
        color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        label: "General",
        theme: "indigo"
    }
}

export function ChatInput({
    inputValue,
    onInputChange,
    isLoading,
    hasMessages,
    uploadedFiles,
    onSend,
    onStop,
    onImprovePrompt,
    onFileUpload,
    onPasteFiles,
    onRemoveFile,
    onPreviewAttachment,
    isImprovingPrompt,
    isThinking,
    isWebSearch,
    isDeepResearch,
    isConfidenceMode,
    onThinkingChange,
    onWebSearchChange,
    onDeepResearchChange,
    onConfidenceModeChange,
    mode,
    isFileDialogOpen,
    onFileDialogChange,
}: ChatInputProps) {
    const [prompts, setPrompts] = React.useState<PromptItem[]>([])
    const [showSlashMenu, setShowSlashMenu] = React.useState(false)
    const [slashSearch, setSlashSearch] = React.useState("")
    const [selectedPromptIdx, setSelectedPromptIdx] = React.useState(0)
    const slashMenuRef = React.useRef<HTMLDivElement>(null)

    // States for the advanced Prompts Popover (Harvey/Legora style)
    const [popoverSearch, setPopoverSearch] = React.useState("")
    const [popoverCategory, setPopoverCategory] = React.useState("All")
    const [selectedPopoverPrompt, setSelectedPopoverPrompt] = React.useState<PromptItem | null>(null)
    const [promptVariables, setPromptVariables] = React.useState<Record<string, string>>({})

    // Keep popover selection synchronized with filter changes
    const filteredPopoverPrompts = React.useMemo(() => {
        return prompts.filter((p) => {
            const matchesSearch = p.title.toLowerCase().includes(popoverSearch.toLowerCase()) || 
                                 (p.description && p.description.toLowerCase().includes(popoverSearch.toLowerCase()))
            
            if (popoverCategory === "All") return matchesSearch
            
            const meta = getCategoryMeta(p.category)
            return meta.label.toLowerCase() === popoverCategory.toLowerCase() && matchesSearch
        })
    }, [prompts, popoverSearch, popoverCategory])

    // Auto-select the first prompt when list changes
    React.useEffect(() => {
        if (filteredPopoverPrompts.length > 0) {
            // Only auto-select if current selection is not in the new filtered list
            setSelectedPopoverPrompt(prev => {
                if (prev && filteredPopoverPrompts.some(p => p.id === prev.id)) {
                    return prev
                }
                return filteredPopoverPrompts[0]
            })
        } else {
            setSelectedPopoverPrompt(null)
        }
    }, [filteredPopoverPrompts])

    // Whenever selected prompt changes, parse its variable placeholders
    React.useEffect(() => {
        if (selectedPopoverPrompt) {
            const matches = Array.from(selectedPopoverPrompt.content.matchAll(/\{\{([^}]+)\}\}/g))
            const variables = Array.from(new Set(matches.map((m) => m[1])))
            const initialVars: Record<string, string> = {}
            variables.forEach((v) => {
                initialVars[v] = ""
            })
            setPromptVariables(initialVars)
        } else {
            setPromptVariables({})
        }
    }, [selectedPopoverPrompt])

    React.useEffect(() => {
        const fetchPrompts = async () => {
            try {
                const res = await fetch("/api/prompt-library?limit=100")
                if (res.ok) {
                    setPrompts(await res.json())
                }
            } catch {
                // Fail silently — don't block main chat interface
            }
        }
        fetchPrompts()
    }, [])

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (slashMenuRef.current && !slashMenuRef.current.contains(event.target as Node)) {
                setShowSlashMenu(false)
            }
        }
        if (showSlashMenu) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showSlashMenu])

    const filteredPrompts = React.useMemo(() => {
        if (!slashSearch) return prompts.slice(0, 8)
        return prompts
            .filter(p => 
                p.title.toLowerCase().includes(slashSearch.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(slashSearch.toLowerCase()))
            )
            .slice(0, 8)
    }, [prompts, slashSearch])

    const insertPrompt = (prompt: PromptItem) => {
        const textarea = document.getElementById("chat-input") as HTMLTextAreaElement | null
        if (!textarea) return

        const caretPos = textarea.selectionStart || 0
        const textBeforeCaret = inputValue.substring(0, caretPos)
        const textAfterCaret = inputValue.substring(caretPos)

        const slashIdx = textBeforeCaret.lastIndexOf("/")
        if (slashIdx === -1) return

        const newText = textBeforeCaret.substring(0, slashIdx) + prompt.content + textAfterCaret
        onInputChange(newText)
        setShowSlashMenu(false)

        setTimeout(() => {
            textarea.focus()
            const firstVarMatch = prompt.content.match(/\{\{([^}]+)\}\}/)
            if (firstVarMatch && firstVarMatch.index !== undefined) {
                const start = slashIdx + firstVarMatch.index
                const end = start + firstVarMatch[0].length
                textarea.setSelectionRange(start, end)
            } else {
                const newCaretPos = slashIdx + prompt.content.length
                textarea.setSelectionRange(newCaretPos, newCaretPos)
            }
        }, 10)
    }

    const handleInputChangeInternal = (value: string) => {
        onInputChange(value)

        const textarea = document.getElementById("chat-input") as HTMLTextAreaElement | null
        if (!textarea) return

        const caretPos = textarea.selectionStart || 0
        const textBeforeCaret = value.substring(0, caretPos)
        
        const match = textBeforeCaret.match(/(?:^|\s)\/(\w*)$/)
        if (match) {
            setShowSlashMenu(true)
            setSlashSearch(match[1])
            setSelectedPromptIdx(0)
        } else {
            setShowSlashMenu(false)
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = Array.from(e.clipboardData?.items || [])
        const fileItems = clipboardItems.filter((item) => item.kind === 'file')
        if (fileItems.length === 0) return

        const pastedImages: File[] = []
        let unsupportedFileCount = 0
        const pasteDate = new Date()

        fileItems.forEach((item) => {
            const file = item.getAsFile()
            if (!file) return

            if (!getSupportedClipboardImageExtension(file.type)) {
                unsupportedFileCount += 1
                return
            }

            pastedImages.push(createScreenshotFile(file, pastedImages.length, pasteDate))
        })

        if (pastedImages.length === 0) {
            if (unsupportedFileCount > 0) {
                toast.error("Only PNG, JPG, or WebP images can be pasted into Wesley.")
            }
            return
        }

        e.preventDefault()
        onPasteFiles(pastedImages)

        if (unsupportedFileCount > 0) {
            toast.error("Some pasted files were not supported.")
        }
    }

    return (
        <div ref={slashMenuRef} className={`w-full z-20 pb-6 pt-2 px-2 md:px-8 bg-transparent relative ${!hasMessages ? "mt-4 max-w-4xl mx-auto" : "mt-auto max-w-5xl mx-auto"}`}>
            {/* Slash autocomplete overlay (Harvey/Legora-style) */}
            {showSlashMenu && filteredPrompts.length > 0 && (
                <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto md:left-10 mb-3 z-50 sm:w-80 bg-card border border-border/60 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-h-60 sm:max-h-72 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="px-2.5 py-2 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest border-b border-border/50 mb-1.5 flex justify-between items-center">
                        <span>Legal Templates</span>
                        <span>{filteredPrompts.length} matching</span>
                    </div>
                    {filteredPrompts.map((prompt, idx) => {
                        const meta = getCategoryMeta(prompt.category)
                        const Icon = meta.icon
                        return (
                            <button
                                key={prompt.id}
                                type="button"
                                onClick={() => insertPrompt(prompt)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-3 ${idx === selectedPromptIdx ? "bg-muted/90 text-foreground font-medium shadow-sm scale-[0.99]" : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"}`}
                            >
                                <div className={`p-1.5 rounded-lg shrink-0 ${meta.color.split(" ")[1]} ${meta.color.split(" ")[0]}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-semibold text-foreground truncate">{prompt.title}</span>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground shrink-0">{meta.label}</span>
                                    </div>
                                    {prompt.description && (
                                        <span className="text-[10px] opacity-75 line-clamp-1 mt-0.5">{prompt.description}</span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Quick Prompt Chips (Legora-style) - Replaced by beautiful infinite marquee */}
            {false && !hasMessages && inputValue.trim().length === 0 && uploadedFiles.length === 0 && prompts.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {prompts.slice(0, 4).map((prompt) => (
                        <Button
                            key={prompt.id}
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                                onInputChange(prompt.content)
                                const textarea = document.getElementById("chat-input") as HTMLTextAreaElement | null
                                if (textarea) {
                                    setTimeout(() => {
                                        textarea.focus()
                                        const firstVarMatch = prompt.content.match(/\{\{([^}]+)\}\}/)
                                        if (firstVarMatch && firstVarMatch.index !== undefined) {
                                            textarea.setSelectionRange(firstVarMatch.index, firstVarMatch.index + firstVarMatch[0].length)
                                        }
                                    }, 10)
                                }
                            }}
                             className="rounded-full bg-card hover:bg-muted border-border/60 text-xs text-muted-foreground hover:text-foreground shadow-sm gap-1.5 transition-all duration-200"
                        >
                            <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                            {prompt.title}
                        </Button>
                    ))}
                </div>
            )}

            <div className="relative rounded-[2rem] border border-border/60 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-border overflow-hidden">

                {/* Mode Badges */}
                {mode === "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="inline" />}
                {mode !== "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="absolute" />}

                {/* Uploaded file pills */}
                {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/5">
                        {uploadedFiles.map((file, idx) => (
                            file.type === 'image' && file.url ? (
                                <div
                                    key={idx}
                                    onClick={() => onPreviewAttachment(file)}
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
                                            onRemoveFile(file.name)
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
                                    onClick={() => onPreviewAttachment(file)}
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
                                            onRemoveFile(file.name)
                                        }}
                                        aria-label={`Remove ${file.name}`}
                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )
                        ))}
                    </div>
                )}

                {/* Text input */}
                <Textarea
                    id="chat-input"
                    placeholder={isLoading ? "AI is thinking..." : isImprovingPrompt ? "Rewriting prompt..." : "Ask Wesley anything — type / for templates"}
                    className={`${hasMessages ? "min-h-[44px]" : "min-h-[120px]"} max-h-[50vh] overflow-y-auto w-full resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 p-4 text-base ${(isThinking || isWebSearch || isDeepResearch) && mode !== "project" ? "pt-10" : ""}`}
                    value={inputValue}
                    onChange={(e) => handleInputChangeInternal(e.target.value)}
                    onPaste={handlePaste}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                        if (showSlashMenu && filteredPrompts.length > 0) {
                            if (e.key === "ArrowDown") {
                                e.preventDefault()
                                setSelectedPromptIdx(prev => (prev + 1) % filteredPrompts.length)
                                return
                            }
                            if (e.key === "ArrowUp") {
                                e.preventDefault()
                                setSelectedPromptIdx(prev => (prev - 1 + filteredPrompts.length) % filteredPrompts.length)
                                return
                            }
                            if (e.key === "Enter") {
                                e.preventDefault()
                                insertPrompt(filteredPrompts[selectedPromptIdx])
                                return
                            }
                            if (e.key === "Escape") {
                                e.preventDefault()
                                setShowSlashMenu(false)
                                return
                            }
                        }

                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            onSend()
                        }
                    }}
                />

                {/* Action bar */}
                <div className={`flex items-center justify-between p-3 ${hasMessages ? "" : "border-t"} bg-muted/20 rounded-b-xl`}>
                    <div className="flex items-center gap-1 md:gap-2">
                        {/* File upload dialog */}
                        <Dialog open={isFileDialogOpen} onOpenChange={onFileDialogChange}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 px-2 md:px-3" id="files-button">
                                    <Paperclip className="h-4 w-4" />
                                    <span className="hidden md:inline">Files and sources</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Upload Files</DialogTitle>
                                    <DialogDescription>
                                        Drag and drop files here or click to browse.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex items-center justify-center w-full">
                                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">Any file size accepted</p>
                                        </div>
                                        <Input id="dropzone-file" type="file" multiple className="hidden" onChange={onFileUpload} />
                                    </label>
                                </div>
                                <div className="mt-4 flex flex-col gap-2">
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-background px-2 text-muted-foreground">Or import from</span>
                                        </div>
                                    </div>
                                    <Button variant="outline" className="w-full gap-2" onClick={() => toast.info("Google Drive integration coming soon!")}>
                                        <Cloud className="h-4 w-4" />
                                        Google Drive
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Prompts Popover (Harvey/Legora-style Directory) */}
                        {!isLoading && prompts.length > 0 && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 px-2 md:px-3">
                                        <BookOpen className="h-4 w-4" />
                                        <span className="hidden md:inline">Prompts</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[95vw] sm:w-[440px] md:w-[740px] max-w-[95vw] p-0 rounded-2xl overflow-hidden border border-border/60 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)] bg-card" align="start">
                                    {/* 1. Header with Search */}
                                    <div className="p-3 sm:p-4 border-b bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                                        <div>
                                            <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                                <BookOpen className="h-4 w-4 text-primary" />
                                                Prompt Directory
                                            </h3>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">Customize and inject premium legal templates instantly</p>
                                        </div>
                                        <div className="relative w-full sm:w-48 md:w-56 shrink-0">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                type="text"
                                                placeholder="Search templates..."
                                                value={popoverSearch}
                                                onChange={(e) => setPopoverSearch(e.target.value)}
                                                className="h-8.5 pl-8 pr-7 text-xs bg-background/50 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-ring/25"
                                            />
                                            {popoverSearch && (
                                                <button
                                                    onClick={() => setPopoverSearch("")}
                                                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Split Body */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 h-[50vh] sm:h-[55vh] md:h-[400px] max-h-[400px] overflow-hidden">
                                        
                                        {/* ─── LEFT COLUMN (List & Filters) ─── */}
                                        <div className={`col-span-1 md:col-span-5 border-r border-border/50 flex flex-col h-full overflow-hidden bg-muted/5 ${selectedPopoverPrompt ? 'hidden md:flex' : 'flex'}`}>
                                            
                                            {/* Category Tab Pills */}
                                            <div className="flex gap-1.5 p-2 overflow-x-auto no-scrollbar border-b border-border/40 shrink-0 bg-background/30">
                                                {["All", "Corporate", "Litigation", "Contracts", "Compliance"].map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setPopoverCategory(cat)}
                                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-all shrink-0 ${popoverCategory === cat ? "bg-primary text-primary-foreground font-semibold" : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Prompts Cards List */}
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-muted">
                                                {filteredPopoverPrompts.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                                        <Info className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                                        <span className="text-[11px] font-medium text-muted-foreground">No prompts found</span>
                                                    </div>
                                                ) : (
                                                    filteredPopoverPrompts.map((prompt) => {
                                                        const meta = getCategoryMeta(prompt.category)
                                                        const Icon = meta.icon
                                                        const isSelected = selectedPopoverPrompt?.id === prompt.id
                                                        return (
                                                            <button
                                                                key={prompt.id}
                                                                type="button"
                                                                onClick={() => setSelectedPopoverPrompt(prompt)}
                                                                className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start gap-2.5 border ${isSelected ? "bg-card border-primary/20 shadow-[0_2px_8px_rgba(0,0,0,0.03)]" : "bg-transparent border-transparent hover:bg-muted/50 text-muted-foreground"}`}
                                                            >
                                                                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${isSelected ? meta.color.split(" ")[1] + " " + meta.color.split(" ")[0] : "bg-muted text-muted-foreground"}`}>
                                                                    <Icon className="h-3.5 w-3.5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className={`text-[11px] font-semibold truncate ${isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>{prompt.title}</span>
                                                                    </div>
                                                                    {prompt.description && (
                                                                        <p className="text-[10px] leading-relaxed line-clamp-2 mt-0.5 text-muted-foreground/80">{prompt.description}</p>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* ─── RIGHT COLUMN (Variables & Preview Form) ─── */}
                                        <div className={`col-span-1 md:col-span-7 flex flex-col h-full overflow-hidden bg-card ${selectedPopoverPrompt ? 'flex' : 'hidden md:flex'}`}>
                                            {selectedPopoverPrompt ? (
                                                <div className="flex flex-col h-full overflow-hidden">
                                                    
                                                    {/* Scrollable details and form parameters */}
                                                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-muted">
                                                        {/* Mobile back button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedPopoverPrompt(null)}
                                                            className="md:hidden flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground mb-1 transition-colors"
                                                        >
                                                            <span>←</span> Back to templates
                                                        </button>
                                                        
                                                        {/* Metadata header */}
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                                                    {selectedPopoverPrompt.type || "Prompt"}
                                                                </span>
                                                                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                                                <span className="text-[10px] text-primary bg-primary/10 border border-primary/10 px-1.5 py-0.5 rounded-full font-medium">
                                                                    {getCategoryMeta(selectedPopoverPrompt.category).label}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-semibold text-sm text-foreground mt-1">{selectedPopoverPrompt.title}</h4>
                                                            {selectedPopoverPrompt.description && (
                                                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">{selectedPopoverPrompt.description}</p>
                                                            )}
                                                        </div>

                                                        <hr className="border-border/40" />

                                                        {/* Dynamic Form Parameter inputs */}
                                                        {Object.keys(promptVariables).length > 0 ? (
                                                            <div className="space-y-3.5">
                                                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                                    <Wand2 className="h-3 w-3 text-primary animate-pulse" />
                                                                    Template Parameters
                                                                </div>
                                                                <div className="grid gap-3">
                                                                    {Object.keys(promptVariables).map((v) => {
                                                                        // Beautify variable label
                                                                        const label = v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                                                                        return (
                                                                            <div key={v} className="space-y-1">
                                                                                <label className="text-[10px] font-medium text-foreground">{label}</label>
                                                                                <Input
                                                                                    type="text"
                                                                                    placeholder={`Value for {{${v}}}`}
                                                                                    value={promptVariables[v]}
                                                                                    onChange={(e) => {
                                                                                        setPromptVariables((prev) => ({
                                                                                            ...prev,
                                                                                            [v]: e.target.value,
                                                                                        }))
                                                                                    }}
                                                                                    className="h-8 text-xs bg-background border-border/60 rounded-md focus-visible:ring-1 focus-visible:ring-ring/20"
                                                                                />
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-muted/15 border border-border/45 rounded-xl p-3 flex items-start gap-2.5 text-muted-foreground text-[10px] leading-relaxed">
                                                                <Info className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
                                                                This prompt template does not require any parameters and is ready to insert.
                                                            </div>
                                                        )}

                                                        {/* Interactive Live Preview Box */}
                                                        <div className="space-y-1.5">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                Template Text Preview
                                                            </div>
                                                            <div className="bg-muted/30 border border-border/40 rounded-xl p-3 text-[10.5px] leading-relaxed text-foreground/80 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                                {(() => {
                                                                    const text = selectedPopoverPrompt.content
                                                                    // Highlight variables in preview
                                                                    const parts: React.ReactNode[] = []
                                                                    let lastIdx = 0
                                                                    const regex = /\{\{([^}]+)\}\}/g
                                                                    let match
                                                                    let keyIdx = 0
                                                                    while ((match = regex.exec(text)) !== null) {
                                                                        const start = match.index
                                                                        const end = regex.lastIndex
                                                                        const varName = match[1]
                                                                        const varValue = promptVariables[varName] || `{{${varName}}}`

                                                                        // Push preceding text
                                                                        if (start > lastIdx) {
                                                                            parts.push(text.substring(lastIdx, start))
                                                                        }

                                                                        // Push highlighted placeholder
                                                                        parts.push(
                                                                            <span
                                                                                key={keyIdx++}
                                                                                className={`px-1 rounded border text-[10px] font-semibold transition-all ${
                                                                                    promptVariables[varName]
                                                                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                                                                        : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                                                                }`}
                                                                            >
                                                                                {varValue}
                                                                            </span>
                                                                        )
                                                                        lastIdx = end
                                                                    }
                                                                    if (lastIdx < text.length) {
                                                                        parts.push(text.substring(lastIdx))
                                                                    }
                                                                    return parts.length > 0 ? parts : text
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Footer insert button */}
                                                    <div className="p-2.5 sm:p-3 border-t bg-muted/15 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
                                                        <a
                                                            href="/prompt-library"
                                                            className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1.5"
                                                        >
                                                            Open Library
                                                            <span className="opacity-60 font-normal">→</span>
                                                        </a>
                                                        <Button
                                                            size="sm"
                                                            className="gap-1.5 h-8.5 rounded-lg text-xs font-semibold px-4"
                                                            onClick={() => {
                                                                // Merge template text with parameters
                                                                let finalContent = selectedPopoverPrompt.content
                                                                Object.keys(promptVariables).forEach((v) => {
                                                                    const placeholder = `{{${v}}}`
                                                                    const val = promptVariables[v].trim() || placeholder
                                                                    finalContent = finalContent.replaceAll(placeholder, val)
                                                                })

                                                                onInputChange(finalContent)
                                                                const textarea = document.getElementById("chat-input") as HTMLTextAreaElement | null
                                                                if (textarea) {
                                                                    setTimeout(() => {
                                                                        textarea.focus()
                                                                        // If there were any unfilled parameters, select them
                                                                        const unfilledMatch = finalContent.match(/\{\{([^}]+)\}\}/)
                                                                        if (unfilledMatch && unfilledMatch.index !== undefined) {
                                                                            textarea.setSelectionRange(unfilledMatch.index, unfilledMatch.index + unfilledMatch[0].length)
                                                                        } else {
                                                                            // Otherwise place cursor at the end
                                                                            textarea.setSelectionRange(finalContent.length, finalContent.length)
                                                                        }
                                                                    }, 10)
                                                                }
                                                            }}
                                                        >
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                            Use Template
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                                    <Info className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                                    <span className="text-[11px] font-medium text-muted-foreground">Select a template</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        {/* Web Search toggle */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${isWebSearch ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "text-muted-foreground"}`} onClick={() => {
                                        const newState = !isWebSearch
                                        onWebSearchChange(newState)
                                        if (newState) {
                                            onThinkingChange(false)
                                            onDeepResearchChange(false)
                                        }
                                    }}>
                                        <Globe className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Web Search</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Thinking toggle */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${isThinking ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20" : "text-muted-foreground"}`} onClick={() => {
                                        const newState = !isThinking
                                        onThinkingChange(newState)
                                        if (newState) {
                                            onWebSearchChange(false)
                                            onDeepResearchChange(false)
                                        }
                                    }}>
                                        <Brain className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Thinking (Reasoning)</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Deep Research toggle */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        id="deep-research-toggle"
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 rounded-full ${isDeepResearch ? "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" : "text-muted-foreground"}`}
                                        onClick={() => {
                                            toast.info("🔬 Deep Research is coming soon!", {
                                                description: "This feature is currently under development and will be available shortly.",
                                            })
                                        }}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Deep Research</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Confidence Mode toggle */}
                        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border h-6">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id="confidence-mode-toggle"
                                                checked={isConfidenceMode}
                                                onCheckedChange={onConfidenceModeChange}
                                                className="data-[state=checked]:bg-amber-500 scale-90"
                                            />
                                            <label
                                                htmlFor="confidence-mode-toggle"
                                                className="text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hidden sm:inline"
                                            >
                                                Verification
                                            </label>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[200px] text-center">Confidence Mode: Strictly verifies AI facts against your documents.</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 md:gap-2 text-foreground/80 hover:text-foreground transition-all px-3 md:px-4 bg-background hover:bg-muted disabled:opacity-50"
                            onClick={onImprovePrompt}
                            disabled={isLoading || isImprovingPrompt || !inputValue.trim()}
                        >
                            <Wand2 className={`h-3 w-3 ${isImprovingPrompt ? "animate-pulse text-primary" : "text-primary"}`} />
                            <span className="hidden sm:inline">{isImprovingPrompt ? "Improving..." : "Improve"}</span>
                        </Button>
                        <Button
                            size="sm"
                            className={`gap-2 bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-50 px-3 md:px-4 transition-all`}
                            onClick={isLoading ? onStop : onSend}
                            disabled={!isLoading && (!inputValue.trim() && uploadedFiles.length === 0)}
                        >
                            {isLoading ? (
                                <>
                                    <Square className="h-3 w-3 fill-current" />
                                    <span>Stop</span>
                                </>
                            ) : (
                                <>
                                    <span className="hidden sm:inline">Ask Wesley</span>
                                    <span className="sm:hidden">Ask</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
