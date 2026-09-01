"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { ModeBadges } from "@/components/chat/mode-badges"
import { SlashAutocomplete } from "@/components/chat/slash-autocomplete"
import { FileUploadPills } from "@/components/chat/file-upload-pills"
import { ChatToolbar } from "@/components/chat/chat-toolbar"
import { getSupportedClipboardImageExtension, createScreenshotFile } from "@/components/chat/clipboard-utils"
import type { PromptItem } from "@/components/chat/category-meta"
import { toast } from "sonner"
import type { Attachment } from "@/types"

// Re-export clipboard utilities used by other modules
export { getSupportedClipboardImageExtension, getScreenshotFileName, createScreenshotFile } from "@/components/chat/clipboard-utils"

// ─── Props ───────────────────────────────────────────────────────

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
    isLiveResearch: boolean
    onThinkingChange: (v: boolean) => void
    onWebSearchChange: (v: boolean) => void
    onDeepResearchChange: (v: boolean) => void
    onConfidenceModeChange: (v: boolean) => void
    onLiveResearchChange: (v: boolean) => void
    mode: "default" | "project"
    isFileDialogOpen: boolean
    onFileDialogChange: (open: boolean) => void
}

// ─── Component ───────────────────────────────────────────────────

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
    isLiveResearch,
    onThinkingChange,
    onWebSearchChange,
    onDeepResearchChange,
    onConfidenceModeChange,
    onLiveResearchChange,
    mode,
    isFileDialogOpen,
    onFileDialogChange,
}: ChatInputProps) {
    // ─── Prompt Library State ────────────────────────────────────
    const [prompts, setPrompts] = React.useState<PromptItem[]>([])
    const [showSlashMenu, setShowSlashMenu] = React.useState(false)
    const [slashSearch, setSlashSearch] = React.useState("")
    const [selectedPromptIdx, setSelectedPromptIdx] = React.useState(0)
    const slashMenuRef = React.useRef<HTMLDivElement>(null)

    // Fetch prompts once on mount
    React.useEffect(() => {
        const fetchPrompts = async () => {
            try {
                const res = await fetch("/api/prompt-library?limit=100")
                if (res.ok) setPrompts(await res.json())
            } catch {
                // Fail silently — don't block main chat interface
            }
        }
        fetchPrompts()
    }, [])

    // Close slash menu on outside click
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (slashMenuRef.current && !slashMenuRef.current.contains(event.target as Node)) {
                setShowSlashMenu(false)
            }
        }
        if (showSlashMenu) document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [showSlashMenu])

    // ─── Filtered Slash Prompts ──────────────────────────────────
    const filteredPrompts = React.useMemo(() => {
        if (!slashSearch) return prompts.slice(0, 8)
        return prompts
            .filter((p) =>
                p.title.toLowerCase().includes(slashSearch.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(slashSearch.toLowerCase()))
            )
            .slice(0, 8)
    }, [prompts, slashSearch])

    // ─── Prompt Insertion ────────────────────────────────────────
    const insertPrompt = React.useCallback(
        (prompt: PromptItem) => {
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
        },
        [inputValue, onInputChange]
    )

    // ─── Insert from Popover ─────────────────────────────────────
    const handlePopoverInsert = React.useCallback(
        (content: string) => {
            onInputChange(content)
            const textarea = document.getElementById("chat-input") as HTMLTextAreaElement | null
            if (textarea) {
                setTimeout(() => {
                    textarea.focus()
                    const unfilledMatch = content.match(/\{\{([^}]+)\}\}/)
                    if (unfilledMatch && unfilledMatch.index !== undefined) {
                        textarea.setSelectionRange(unfilledMatch.index, unfilledMatch.index + unfilledMatch[0].length)
                    } else {
                        textarea.setSelectionRange(content.length, content.length)
                    }
                }, 10)
            }
        },
        [onInputChange]
    )

    // ─── Input Change with Slash Detection ───────────────────────
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

    // ─── Paste Handler ───────────────────────────────────────────
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = Array.from(e.clipboardData?.items || [])
        const fileItems = clipboardItems.filter((item) => item.kind === "file")
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

    // ─── Keyboard Handler ────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showSlashMenu && filteredPrompts.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault()
                setSelectedPromptIdx((prev) => (prev + 1) % filteredPrompts.length)
                return
            }
            if (e.key === "ArrowUp") {
                e.preventDefault()
                setSelectedPromptIdx((prev) => (prev - 1 + filteredPrompts.length) % filteredPrompts.length)
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
    }

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div
            ref={slashMenuRef}
            className={`w-full z-20 pb-6 pt-2 px-2 md:px-8 bg-transparent relative ${!hasMessages ? "mt-4 max-w-4xl mx-auto" : "mt-auto max-w-5xl mx-auto"}`}
        >
            {/* Slash autocomplete overlay */}
            {showSlashMenu && (
                <SlashAutocomplete
                    prompts={filteredPrompts}
                    selectedIdx={selectedPromptIdx}
                    onSelect={insertPrompt}
                />
            )}

            <div className="relative rounded-[2rem] border border-border/60 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-border overflow-hidden">
                {/* Mode Badges */}
                {mode === "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="inline" />}
                {mode !== "project" && <ModeBadges isThinking={isThinking} isWebSearch={isWebSearch} isDeepResearch={isDeepResearch} position="absolute" />}

                {/* Uploaded file pills */}
                <FileUploadPills files={uploadedFiles} onRemove={onRemoveFile} onPreview={onPreviewAttachment} />

                {/* Text input */}
                <Textarea
                    id="chat-input"
                    placeholder={isLoading ? "AI is thinking..." : isImprovingPrompt ? "Rewriting prompt..." : "Ask Wesley anything — type / for templates"}
                    className={`${hasMessages ? "min-h-[44px]" : "min-h-[120px]"} max-h-[50vh] overflow-y-auto w-full resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 p-4 text-base ${(isThinking || isWebSearch || isDeepResearch) && mode !== "project" ? "pt-10" : ""}`}
                    value={inputValue}
                    onChange={(e) => handleInputChangeInternal(e.target.value)}
                    onPaste={handlePaste}
                    disabled={isLoading}
                    onKeyDown={handleKeyDown}
                />

                {/* Action bar */}
                <ChatToolbar
                    hasMessages={hasMessages}
                    isLoading={isLoading}
                    inputValue={inputValue}
                    uploadedFiles={uploadedFiles}
                    prompts={prompts}
                    isThinking={isThinking}
                    isWebSearch={isWebSearch}
                    isDeepResearch={isDeepResearch}
                    isConfidenceMode={isConfidenceMode}
                    isLiveResearch={isLiveResearch}
                    isImprovingPrompt={isImprovingPrompt}
                    onThinkingChange={onThinkingChange}
                    onWebSearchChange={onWebSearchChange}
                    onDeepResearchChange={onDeepResearchChange}
                    onConfidenceModeChange={onConfidenceModeChange}
                    onLiveResearchChange={onLiveResearchChange}
                    onSend={onSend}
                    onStop={onStop}
                    onImprovePrompt={onImprovePrompt}
                    onFileUpload={onFileUpload}
                    onInsertPrompt={handlePopoverInsert}
                    isFileDialogOpen={isFileDialogOpen}
                    onFileDialogChange={onFileDialogChange}
                />
            </div>
        </div>
    )
}
