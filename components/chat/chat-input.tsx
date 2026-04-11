"use client"

import * as React from "react"
import Image from "next/image"
import { Paperclip, Globe, Wand2, UploadCloud, X, Cloud, Brain, Sparkles, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ModeBadges } from "@/components/chat/mode-badges"
import { FileIcon } from "@/components/documents/file-icon"
import { toast } from "sonner"
import type { Attachment } from "@/types"

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
    return (
        <div className={`w-full z-20 pb-6 pt-2 px-2 md:px-8 bg-transparent ${!hasMessages ? "mt-4 max-w-4xl mx-auto" : "mt-auto max-w-5xl mx-auto"}`}>
            <div className="relative rounded-[2rem] border border-border/60 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-border overflow-hidden">

                {/* Mode Badges */}
                {mode === "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="inline" />}
                {mode !== "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="absolute" />}

                {/* Uploaded file pills */}
                {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/5">
                        {uploadedFiles.map((file, idx) => (
                            <div
                                key={idx}
                                onClick={() => onPreviewAttachment(file)}
                                className="relative group flex items-center gap-2.5 p-2 pr-3 rounded-xl border bg-background/50 hover:bg-background hover:border-primary/30 transition-all duration-200 min-w-[140px] max-w-[200px] cursor-pointer"
                            >
                                <div className="h-8 w-8 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center relative overflow-hidden">
                                    {file.type === 'image' && file.url ? (
                                        <Image
                                            src={file.url}
                                            alt={file.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <FileIcon filename={file.name} className="h-5 w-5" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-medium truncate leading-none mb-1">{file.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{file.type}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemoveFile(file.name)}
                                    aria-label={`Remove ${file.name}`}
                                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Text input */}
                <Textarea
                    id="chat-input"
                    placeholder={isLoading ? "AI is thinking..." : isImprovingPrompt ? "Rewriting prompt..." : "Ask Wesley anything..."}
                    className={`${hasMessages ? "min-h-[44px]" : "min-h-[120px]"} max-h-[50vh] overflow-y-auto w-full resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 p-4 text-base ${(isThinking || isWebSearch || isDeepResearch) && mode !== "project" ? "pt-10" : ""}`}
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => {
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
                                                className="text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap"
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
