"use client"

import * as React from "react"

import { Sparkles } from "lucide-react"
import { FileText, Table } from "lucide-react"
import { FilePreviewContent } from "@/components/documents/file-preview-content"
import { Attachment } from "@/types"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CitationsSidebar } from "@/components/citations-sidebar"
import { ActivitySidebar } from "@/components/activity-sidebar"
import { PdfCitationPanel } from "@/components/pdf-citation-panel"
import type { PdfCitationTarget } from "@/components/pdf-citation-panel"
import {
    ChatCitationSource,
    parseSources,
    parseDocumentCitationUrl,
} from "@/lib/citations"
import dynamic from "next/dynamic"

// Extracted sub-components and hook
import { useChatStream } from "@/hooks/use-chat-stream"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"

interface ChatInterfaceProps {
    onMessageSent?: () => void
    mode?: "default" | "project"
    projectTitle?: string
    projectId?: string
    workflowId?: string
    conversationType?: 'assistant' | 'documents' | 'templates'
    initialConversationId?: string
}

const RandomGreeting = dynamic(() => import("@/components/random-greeting"), { ssr: false })

export function ChatInterface({ onMessageSent, mode = "default", projectTitle, projectId, workflowId, conversationType = 'assistant', initialConversationId }: ChatInterfaceProps) {

    // ─── Chat stream hook (manages all state + handlers) ─────────
    const {
        messages, isLoading, conversationId: _convId,
        inputValue, setInputValue,
        isImprovingPrompt,
        uploadedFiles,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isThinking, setIsThinking,
        isWebSearch, setIsWebSearch,
        isDeepResearch, setIsDeepResearch,
        isConfidenceMode, setIsConfidenceMode,
        activityPhase, activityEntries, thinkingDuration,
        isActivitySidebarOpen, setIsActivitySidebarOpen,
        chatContainerRef, messagesEndRef, handleScroll,
        handleSend, handleStop, handleImprovePrompt,
        handleFileUpload, addFilesToUploadQueue, removeFile,
    } = useChatStream({
        projectId,
        workflowId,
        conversationType,
        initialConversationId,
        onMessageSent,
    })

    // ─── Local UI state ──────────────────────────────────────────
    const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null)
    const [isFileDialogOpen, setIsFileDialogOpen] = React.useState(false)
    const [openCitationsIndex, setOpenCitationsIndex] = React.useState<number | null>(null)
    const [isCitationsSidebarOpen, setIsCitationsSidebarOpen] = React.useState(false)
    const [pdfViewerTarget, setPdfViewerTarget] = React.useState<PdfCitationTarget | null>(null)

    // ─── Citation / PDF Viewer helpers ───────────────────────────
    const closeCitationsSidebar = () => {
        setIsCitationsSidebarOpen(false)
        setOpenCitationsIndex(null)
    }

    const openCitations = (index: number) => {
        setOpenCitationsIndex(index)
        setIsCitationsSidebarOpen(true)
    }

    const openPdfViewer = React.useCallback((source: ChatCitationSource, citationNum: string) => {
        const parsed = parseDocumentCitationUrl(source.url)
        if (!parsed) return

        const pageMatch = source.title.match(/Page\s+(\d+)/i)
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : null

        setPdfViewerTarget({
            fileId: parsed.fileId,
            fileName: source.title.split(' — ')[0] || source.title,
            fileUrl: null,
            snippet: source.snippet || '',
            pageNumber,
            chunkIndex: parsed.chunkIndex,
            citationNum,
        })

        setIsCitationsSidebarOpen(false)
        setIsActivitySidebarOpen(false)
    }, [setIsActivitySidebarOpen])

    const closePdfViewer = React.useCallback(() => {
        setPdfViewerTarget(null)
    }, [])

    const hasMessages = messages.length > 0

    return (
        <div className="flex h-full w-full bg-background relative overflow-hidden">
            <div className="flex flex-col flex-1 h-full min-w-0 bg-background relative overflow-hidden">
                <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-2 sm:p-3 md:p-4 relative">

                    {/* Preview Dialog */}
                    <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
                        <DialogContent className="max-w-full sm:max-w-4xl w-[95vw] sm:w-full h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background" aria-describedby={undefined}>
                            {previewAttachment?.type !== 'image' && (
                                <DialogHeader className="p-3 sm:p-4 border-b bg-muted/20">
                                    <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                                        {previewAttachment?.type === 'docx' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" /> :
                                            previewAttachment?.type === 'csv' ? <Table className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" /> :
                                                previewAttachment?.type === 'pdf' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" /> :
                                                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
                                        <span className="truncate">{previewAttachment?.name}</span>
                                    </DialogTitle>
                                </DialogHeader>
                            )}
                            {previewAttachment?.type === 'image' && (
                                <DialogHeader className="sr-only">
                                    <DialogTitle>Image preview</DialogTitle>
                                </DialogHeader>
                            )}
                            <div className="flex-1 min-h-0 bg-muted/10 relative overflow-auto">
                                {previewAttachment && <FilePreviewContent attachment={previewAttachment} />}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Landing Page — visible when no messages */}
                    {!hasMessages && (
                        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 animate-in fade-in zoom-in-95 duration-700">
                            <div className="flex flex-col items-center max-w-2xl mx-auto space-y-6">
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-center text-foreground/90 tracking-tight leading-tight">
                                    {mode === "project" ? projectTitle : <RandomGreeting />}
                                </h1>
                            </div>
                        </div>
                    )}

                    {/* Chat Messages Area */}
                    {hasMessages && (
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 min-h-0 overflow-y-auto mb-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                        >
                            <div className="flex flex-col min-h-full"><div className="space-y-6 shrink-0">
                                {messages.map((msg, i) => (
                                    <MessageBubble
                                        key={i}
                                        msg={msg}
                                        index={i}
                                        isLastMessage={i === messages.length - 1}
                                        activityPhase={activityPhase}
                                        thinkingDuration={thinkingDuration}
                                        isThinking={isThinking}
                                        conversationId={_convId}
                                        onOpenCitations={openCitations}
                                        onOpenPdfViewer={openPdfViewer}
                                        onPreviewAttachment={setPreviewAttachment}
                                        onToggleActivitySidebar={() => setIsActivitySidebarOpen(prev => !prev)}
                                    />
                                ))}
                                {/* Fallback loading dots */}
                                {isLoading && !activityPhase && !messages.some(m => m.role === 'assistant' && m.content) && (
                                    <div className="flex gap-3 justify-start">
                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                                            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                        </div>
                                        <div className="flex items-center gap-1.5 pt-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0s]" />
                                        </div>
                                    </div>
                                )}
                            </div>
                                {isLoading && <div className="flex-1" />}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    )}

                    {/* Chat Input */}
                    <ChatInput
                        inputValue={inputValue}
                        onInputChange={setInputValue}
                        isLoading={isLoading}
                        hasMessages={hasMessages}
                        uploadedFiles={uploadedFiles}
                        onSend={handleSend}
                        onStop={handleStop}
                        onImprovePrompt={handleImprovePrompt}
                        onFileUpload={handleFileUpload}
                        onPasteFiles={(files) => addFilesToUploadQueue(files, {
                            successMessage: (count) => `Added ${count} image${count === 1 ? '' : 's'} from clipboard`
                        })}
                        onRemoveFile={removeFile}
                        onPreviewAttachment={setPreviewAttachment}
                        isImprovingPrompt={isImprovingPrompt}
                        isThinking={isThinking}
                        isWebSearch={isWebSearch}
                        isDeepResearch={isDeepResearch}
                        isConfidenceMode={isConfidenceMode}
                        onThinkingChange={setIsThinking}
                        onWebSearchChange={setIsWebSearch}
                        onDeepResearchChange={setIsDeepResearch}
                        onConfidenceModeChange={setIsConfidenceMode}
                        mode={mode}
                        isFileDialogOpen={isFileDialogOpen}
                        onFileDialogChange={setIsFileDialogOpen}
                    />

                    {
                        // Removed recommended workflows to maintain a clean, minimalist empty state
                    }
                </div>
            </div>
            {/* Activity Sidebar */}
            <ActivitySidebar
                isOpen={isActivitySidebarOpen}
                duration={thinkingDuration}
                entries={activityEntries}
                sources={messages.length > 0 ? parseSources(messages[messages.length - 1].content) : []}
                isThinkingMode={isThinking}
                onClose={() => setIsActivitySidebarOpen(false)}
            />
            {/* Citations Sidebar */}
            <CitationsSidebar
                isOpen={isCitationsSidebarOpen && openCitationsIndex !== null && !isActivitySidebarOpen && !pdfViewerTarget}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? parseSources(messages[openCitationsIndex].content) : []}
                onClose={closeCitationsSidebar}
                onViewPdf={openPdfViewer}
            />
            {/* PDF Citation Panel */}
            <PdfCitationPanel
                target={pdfViewerTarget}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? parseSources(messages[openCitationsIndex].content) : (messages.length > 0 ? parseSources(messages[messages.length - 1].content) : [])}
                onClose={closePdfViewer}
                onCitationClick={(src) => openPdfViewer(src, src.num)}
            />
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </div>
    )
}
