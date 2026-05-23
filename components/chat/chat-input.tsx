"use client"

import * as React from "react"
import Image from "next/image"
import { Paperclip, Globe, Wand2, UploadCloud, X, Cloud, Brain, Sparkles, Square, BookOpen } from "lucide-react"
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
            {/* Slash autocomplete overlay (Harvey-style) */}
            {showSlashMenu && filteredPrompts.length > 0 && (
                <div className="absolute bottom-full left-4 md:left-10 mb-2 z-50 w-72 bg-card border border-border/60 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="px-2.5 py-1.5 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest border-b border-border/50 mb-1">
                        Prompt Templates
                    </div>
                    {filteredPrompts.map((prompt, idx) => (
                        <button
                            key={prompt.id}
                            type="button"
                            onClick={() => insertPrompt(prompt)}
                            className={`w-full text-left px-2.5 py-2 rounded-xl transition-all duration-150 flex flex-col gap-0.5 ${idx === selectedPromptIdx ? "bg-muted text-foreground font-medium" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                        >
                            <span className="text-xs font-semibold">{prompt.title}</span>
                            {prompt.description && (
                                <span className="text-[10px] opacity-80 line-clamp-1">{prompt.description}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Quick Prompt Chips (Legora-style) */}
            {!hasMessages && inputValue.trim().length === 0 && uploadedFiles.length === 0 && prompts.length > 0 && (
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
                    placeholder={isLoading ? "AI is thinking..." : isImprovingPrompt ? "Rewriting prompt..." : "Ask Wesley anything..."}
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
                                <PopoverContent className="w-80 p-0 rounded-2xl overflow-hidden border border-border/60 shadow-2xl bg-card" align="start">
                                    <div className="p-4 border-b bg-muted/20">
                                        <h3 className="font-semibold text-sm">Prompt Library</h3>
                                        <p className="text-[11px] text-muted-foreground">Select a legal template to inject into your chat</p>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                                        {prompts.map((prompt) => (
                                            <button
                                                key={prompt.id}
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
                                                className="w-full text-left px-3 py-2 rounded-xl hover:bg-muted/60 transition-colors flex flex-col gap-0.5"
                                            >
                                                <span className="text-xs font-semibold text-foreground">{prompt.title}</span>
                                                {prompt.description && (
                                                    <span className="text-[10px] text-muted-foreground line-clamp-2">{prompt.description}</span>
                                                )}
                                            </button>
                                        ))}
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
