"use client"

import * as React from "react"
import { Paperclip, Globe, Wand2, UploadCloud, Cloud, Brain, Sparkles, Square, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PromptPopover } from "@/components/chat/prompt-popover"
import { toast } from "sonner"
import type { Attachment } from "@/types"
import type { PromptItem } from "@/components/chat/category-meta"

// ─── Types ───────────────────────────────────────────────────────

interface ChatToolbarProps {
    hasMessages: boolean
    isLoading: boolean
    inputValue: string
    uploadedFiles: Attachment[]
    prompts: PromptItem[]

    // Toggles
    isThinking: boolean
    isWebSearch: boolean
    isDeepResearch: boolean
    isConfidenceMode: boolean
    isLiveResearch: boolean
    isImprovingPrompt: boolean
    onThinkingChange: (v: boolean) => void
    onWebSearchChange: (v: boolean) => void
    onDeepResearchChange: (v: boolean) => void
    onConfidenceModeChange: (v: boolean) => void
    onLiveResearchChange: (v: boolean) => void

    // Actions
    onSend: () => void
    onStop: () => void
    onImprovePrompt: () => void
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    onInsertPrompt: (content: string) => void

    // File dialog
    isFileDialogOpen: boolean
    onFileDialogChange: (open: boolean) => void
}

// ─── Component ───────────────────────────────────────────────────

export function ChatToolbar({
    hasMessages,
    isLoading,
    inputValue,
    uploadedFiles,
    prompts,
    isThinking,
    isWebSearch,
    isDeepResearch,
    isConfidenceMode,
    isLiveResearch,
    isImprovingPrompt,
    onThinkingChange,
    onWebSearchChange,
    onDeepResearchChange,
    onConfidenceModeChange,
    onLiveResearchChange,
    onSend,
    onStop,
    onImprovePrompt,
    onFileUpload,
    onInsertPrompt,
    isFileDialogOpen,
    onFileDialogChange,
}: ChatToolbarProps) {
    return (
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

                {/* Prompts Popover */}
                <PromptPopover prompts={prompts} isLoading={isLoading} onInsert={onInsertPrompt} />

                {/* Web Search toggle */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 rounded-full ${isWebSearch ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "text-muted-foreground"}`}
                                onClick={() => {
                                    const newState = !isWebSearch
                                    onWebSearchChange(newState)
                                    if (newState) {
                                        onThinkingChange(false)
                                        onDeepResearchChange(false)
                                    }
                                }}
                            >
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 rounded-full ${isThinking ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20" : "text-muted-foreground"}`}
                                onClick={() => {
                                    const newState = !isThinking
                                    onThinkingChange(newState)
                                    if (newState) {
                                        onWebSearchChange(false)
                                        onDeepResearchChange(false)
                                    }
                                }}
                            >
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

                {/* Live Web Research toggle (Solari-powered) */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                id="live-research-toggle"
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 rounded-full ${isLiveResearch ? "bg-teal-500/10 text-teal-500 hover:bg-teal-500/20" : "text-muted-foreground"}`}
                                onClick={() => {
                                    const newState = !isLiveResearch
                                    onLiveResearchChange(newState)
                                    if (newState) {
                                        onThinkingChange(false)
                                        onWebSearchChange(false)
                                        onDeepResearchChange(false)
                                    }
                                }}
                            >
                                <Scale className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Live Web Research (Solari)</TooltipContent>
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
                            <TooltipContent className="max-w-[200px] text-center">
                                Confidence Mode: Strictly verifies AI facts against your documents.
                            </TooltipContent>
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
                    className="gap-2 bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-50 px-3 md:px-4 transition-all"
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
    )
}
