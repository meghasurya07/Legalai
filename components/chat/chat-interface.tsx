"use client"

import * as React from "react"

import {
    Sparkles,
    FileText,
    Table,
    UserX,
    Key,
    TrendingUp,
    ShieldCheck,
    Landmark,
    Lock,
    ClipboardList,
    HelpCircle,
    Calculator,
    CloudLightning,
    ShieldAlert,
    Briefcase
} from "lucide-react"
import { FilePreviewContent } from "@/components/documents/file-preview-content"
import { Attachment } from "@/types"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CitationsSidebar } from "@/components/sidebar-panels/citations-sidebar"
import { ActivitySidebar } from "@/components/sidebar-panels/activity-sidebar"
import { PdfCitationPanel } from "@/components/pdf/pdf-citation-panel"
import type { PdfCitationTarget } from "@/components/pdf/pdf-citation-panel"
import {
    ChatCitationSource,
    parseCitationIndex,
    parseDocumentCitationUrl,
} from "@/lib/citations"
import type { CitationEntry } from "@/lib/citations"
import { getRandomGreeting } from "@/components/chat/random-greeting"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

// Extracted sub-components and hook
import { useChatStream } from "@/hooks/use-chat-stream"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { DraftEditorPanel } from "@/components/chat/draft-editor-panel"
import { useUserSettings } from "@/context/user-settings-context"

const COLOR_CLASSES: Record<string, { bg: string, text: string, hover: string }> = {
    rose: {
        bg: "bg-rose-500/10 dark:bg-rose-500/20",
        text: "text-rose-600 dark:text-rose-400",
        hover: "hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)] dark:hover:shadow-[0_0_15px_rgba(244,63,94,0.25)]"
    },
    amber: {
        bg: "bg-amber-500/10 dark:bg-amber-500/20",
        text: "text-amber-600 dark:text-amber-400",
        hover: "hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] dark:hover:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
    },
    emerald: {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        hover: "hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_0_15px_rgba(16,185,129,0.25)]"
    },
    blue: {
        bg: "bg-blue-500/10 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        hover: "hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_0_15px_rgba(59,130,246,0.25)]"
    },
    purple: {
        bg: "bg-purple-500/10 dark:bg-purple-500/20",
        text: "text-purple-600 dark:text-purple-400",
        hover: "hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)] dark:hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]"
    },
    violet: {
        bg: "bg-violet-500/10 dark:bg-violet-500/20",
        text: "text-violet-600 dark:text-violet-400",
        hover: "hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.15)] dark:hover:shadow-[0_0_15px_rgba(139,92,246,0.25)]"
    },
    pink: {
        bg: "bg-pink-500/10 dark:bg-pink-500/20",
        text: "text-pink-600 dark:text-pink-400",
        hover: "hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(236,72,153,0.15)] dark:hover:shadow-[0_0_15px_rgba(236,72,153,0.25)]"
    },
    sky: {
        bg: "bg-sky-500/10 dark:bg-sky-500/20",
        text: "text-sky-600 dark:text-sky-400",
        hover: "hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)] dark:hover:shadow-[0_0_15px_rgba(14,165,233,0.25)]"
    },
    indigo: {
        bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
        text: "text-indigo-600 dark:text-indigo-400",
        hover: "hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] dark:hover:shadow-[0_0_15px_rgba(99,102,241,0.25)]"
    },
    orange: {
        bg: "bg-orange-500/10 dark:bg-orange-500/20",
        text: "text-orange-600 dark:text-orange-400",
        hover: "hover:border-orange-500/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.15)] dark:hover:shadow-[0_0_15px_rgba(249,115,22,0.25)]"
    }
}

const ROW1_PROMPTS = [
    {
        title: "What are my rights when getting fired?",
        content: "Explain my employment rights and severance entitlements under labor law if I am laid off or fired without cause. What steps should I take immediately?",
        icon: UserX,
        color: "rose"
    },
    {
        title: "Create a rental agreement.",
        content: "Draft a comprehensive residential rental agreement for a {{property_type}} in {{state}}. Include terms for security deposit, maintenance, subletting, and termination.",
        icon: Key,
        color: "amber"
    },
    {
        title: "Steps to start a business.",
        content: "Generate a step-by-step legal checklist for starting a new business entity (LLC or Corporation) in {{state}}, covering registration, licensing, and tax requirements.",
        icon: TrendingUp,
        color: "emerald"
    },
    {
        title: "Review a non-disclosure agreement.",
        content: "Review this NDA and assess each clause against standards:\n- Confidentiality scope: Should be mutual\n- Duration: Should not exceed {{max_years}} years\n- Permitted disclosures: Must include employees and advisors on need-to-know\n- Governing law: Preferred {{jurisdiction}}",
        icon: ShieldCheck,
        color: "blue"
    },
    {
        title: "Draft a board resolution.",
        content: "Draft a corporate board resolution authorizing the company to {{action_description}}, with standard recitals, resolutions, and signature blocks.",
        icon: Landmark,
        color: "purple"
    },
    {
        title: "IP transfer clause review.",
        content: "Review this contract's Intellectual Property transfer clause. Ensure all work product is fully assigned to the company and that there are no hidden license-backs or pre-existing IP claims.",
        icon: Lock,
        color: "violet"
    }
]

const ROW2_PROMPTS = [
    {
        title: "Legal checklist before marriage.",
        content: "Create a comprehensive legal checklist of assets, prenuptial considerations, and marital property rights before marriage under the laws of {{state}}.",
        icon: ClipboardList,
        color: "pink"
    },
    {
        title: "How to file a consumer complaint?",
        content: "What are the legal options and steps to file a consumer complaint against a business for deceptive trade practices or defective products in {{state}}?",
        icon: HelpCircle,
        color: "emerald"
    },
    {
        title: "Duties of an accountant?",
        content: "What are the fiduciary duties and legal liabilities of an accountant or CPA under professional standards when managing corporate financial statements?",
        icon: Calculator,
        color: "amber"
    },
    {
        title: "Force majeure trigger events.",
        content: "Analyze if the force majeure clause in this contract adequately covers pandemic-related supply chain disruptions, government restrictions, and labor shortages.",
        icon: CloudLightning,
        color: "sky"
    },
    {
        title: "GDPR compliance check.",
        content: "Evaluate our privacy policy and data collection practices against GDPR requirements, focusing on user consent, data minimization, right to be forgotten, and cross-border transfers.",
        icon: ShieldAlert,
        color: "indigo"
    },
    {
        title: "Share Purchase Agreement review.",
        content: "Review the attached Share Purchase Agreement (SPA) and identify indemnity provisions, flags for uncapped liability, and missing standard representations and warranties.",
        icon: Briefcase,
        color: "orange"
    }
]

interface ChatInterfaceProps {
    onMessageSent?: () => void
    mode?: "default" | "project"
    projectTitle?: string
    projectId?: string
    workflowId?: string
    conversationType?: 'assistant' | 'documents' | 'templates'
    initialConversationId?: string
}



/** Convert message content to ChatCitationSource[] using the dual-format parser. */
function getSourcesFromContent(content: string): ChatCitationSource[] {
    const index = parseCitationIndex(content)
    return index.entries.map((e) => ({
        num: String(e.num),
        title: e.title,
        url: e.url,
        snippet: e.snippet || '',
    }))
}

/** Extract structured CitationEntry[] for the sidebar's grouped display. */
function getEntriesFromContent(content: string): CitationEntry[] {
    const index = parseCitationIndex(content)
    return index.entries
}

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
        isLiveResearch, setIsLiveResearch,
        activityPhase, activityEntries, completedPhases, currentVerb, thinkingDuration,
        isActivitySidebarOpen, setIsActivitySidebarOpen,
        // Draft panel (Harvey-style)
        isDrafting, draftContent, draftTitle, draftType, isDraftStreaming, closeDraftPanel,
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

    // ─── Stable greeting (lazy initializer — never empty, survives tab suspension) ──
    const [greeting] = React.useState(() => getRandomGreeting())
    // Sync user name cache from UserSettingsContext (no extra API call)
    const { settings: userSettingsForCache } = useUserSettings()
    React.useEffect(() => {
        if (userSettingsForCache.user_name) {
            localStorage.setItem('vault_user_name', userSettingsForCache.user_name)
        }
    }, [userSettingsForCache.user_name])

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
    const [isDesktopSplit, setIsDesktopSplit] = React.useState(true)

    React.useEffect(() => {
        const mql = window.matchMedia("(min-width: 1024px)")
        const onChange = () => setIsDesktopSplit(mql.matches)
        mql.addEventListener("change", onChange)
        setIsDesktopSplit(mql.matches)
        return () => mql.removeEventListener("change", onChange)
    }, [])

    const handleMarqueeClick = React.useCallback((content: string) => {
        setInputValue(content)
        const textarea = document.getElementById("chat-input") as HTMLTextAreaElement | null
        if (textarea) {
            setTimeout(() => {
                textarea.focus()
                const match = content.match(/\{\{([^}]+)\}\}/)
                if (match && match.index !== undefined) {
                    textarea.setSelectionRange(match.index, match.index + match[0].length)
                }
            }, 10)
        }
    }, [setInputValue])

    return (
        <div className="flex h-full w-full bg-background relative overflow-hidden">
            <div className={`flex flex-col h-full min-w-0 bg-background relative overflow-hidden transition-all duration-300 ease-in-out ${isDrafting && isDesktopSplit ? 'w-[45%]' : 'flex-1'}`}>
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
                            <div className="flex flex-col items-center max-w-2xl mx-auto space-y-6 mb-6">
                                <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif text-center text-foreground/90 tracking-tight leading-tight" suppressHydrationWarning>
                                    {mode === "project" ? projectTitle : greeting}
                                </h1>
                            </div>

                            {/* Scrolling Prompt Marquee */}
                            <div className="w-full max-w-4xl mx-auto flex flex-col gap-1.5 sm:gap-2.5 mt-0 px-1 sm:px-2 select-none marquee-mask hover-pause">
                                {/* Row 1: Left-to-Right */}
                                <div className="w-full overflow-hidden relative">
                                    <div className="animate-marquee-right flex gap-1.5 sm:gap-2.5">
                                        {[...ROW1_PROMPTS, ...ROW1_PROMPTS].map((prompt, i) => {
                                            const IconComponent = prompt.icon
                                            const colors = COLOR_CLASSES[prompt.color] || COLOR_CLASSES.blue
                                            return (
                                                <button
                                                    key={`r1-${i}`}
                                                    type="button"
                                                    onClick={() => handleMarqueeClick(prompt.content)}
                                                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-border/30 bg-card/50 dark:bg-card/30 text-[10px] sm:text-xs text-foreground/70 hover:text-foreground hover:bg-card/80 dark:hover:bg-card/60 transition-all duration-200 shrink-0 ${colors.hover}`}
                                                >
                                                    <span className={`${colors.text}`}>
                                                        <IconComponent className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                                    </span>
                                                    <span className="font-medium whitespace-nowrap">{prompt.title}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Row 2: Right-to-Left */}
                                <div className="w-full overflow-hidden relative">
                                    <div className="animate-marquee-left flex gap-1.5 sm:gap-2.5">
                                        {[...ROW2_PROMPTS, ...ROW2_PROMPTS].map((prompt, i) => {
                                            const IconComponent = prompt.icon
                                            const colors = COLOR_CLASSES[prompt.color] || COLOR_CLASSES.blue
                                            return (
                                                <button
                                                    key={`r2-${i}`}
                                                    type="button"
                                                    onClick={() => handleMarqueeClick(prompt.content)}
                                                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-border/30 bg-card/50 dark:bg-card/30 text-[10px] sm:text-xs text-foreground/70 hover:text-foreground hover:bg-card/80 dark:hover:bg-card/60 transition-all duration-200 shrink-0 ${colors.hover}`}
                                                >
                                                    <span className={`${colors.text}`}>
                                                        <IconComponent className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                                    </span>
                                                    <span className="font-medium whitespace-nowrap">{prompt.title}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
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
                                        currentVerb={currentVerb}
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
                        onFileUpload={(e) => {
                            handleFileUpload(e)
                            setIsFileDialogOpen(false)
                        }}
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
                        isLiveResearch={isLiveResearch}
                        onThinkingChange={setIsThinking}
                        onWebSearchChange={setIsWebSearch}
                        onDeepResearchChange={setIsDeepResearch}
                        onConfidenceModeChange={setIsConfidenceMode}
                        onLiveResearchChange={setIsLiveResearch}
                        mode={mode}
                        isFileDialogOpen={isFileDialogOpen}
                        onFileDialogChange={setIsFileDialogOpen}
                    />

                    {
                        // Removed recommended workflows to maintain a clean, minimalist empty state
                    }
                </div>
            </div>
            {/* Draft Editor Panel (Harvey-style split pane) */}
            {isDrafting && isDesktopSplit && (
                <div className="w-[55%] h-full shrink-0 transition-all duration-300 ease-in-out">
                    <DraftEditorPanel
                        isOpen={isDrafting}
                        title={draftTitle}
                        documentType={draftType}
                        content={draftContent}
                        isStreaming={isDraftStreaming}
                        onClose={closeDraftPanel}
                    />
                </div>
            )}
            {/* Draft Editor Panel — Sheet overlay on mobile */}
            {isDrafting && !isDesktopSplit && (
                <Sheet open={isDrafting} onOpenChange={(open) => !open && closeDraftPanel()}>
                    <SheetContent side="right" className="w-full sm:max-w-full p-0 [&>button]:hidden">
                        <SheetTitle className="sr-only">Draft Editor</SheetTitle>
                        <DraftEditorPanel
                            isOpen={isDrafting}
                            title={draftTitle}
                            documentType={draftType}
                            content={draftContent}
                            isStreaming={isDraftStreaming}
                            onClose={closeDraftPanel}
                        />
                    </SheetContent>
                </Sheet>
            )}
            {/* Activity Sidebar */}
            <ActivitySidebar
                isOpen={isActivitySidebarOpen}
                duration={thinkingDuration}
                entries={activityEntries}
                completedPhases={completedPhases}
                sources={messages.length > 0 ? getSourcesFromContent(messages[messages.length - 1].content) : []}
                isThinkingMode={isThinking}
                onClose={() => setIsActivitySidebarOpen(false)}
            />
            {/* Citations Sidebar */}
            <CitationsSidebar
                isOpen={isCitationsSidebarOpen && openCitationsIndex !== null && !isActivitySidebarOpen && !pdfViewerTarget}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? getSourcesFromContent(messages[openCitationsIndex].content) : []}
                entries={openCitationsIndex !== null && messages[openCitationsIndex] ? getEntriesFromContent(messages[openCitationsIndex].content) : []}
                onClose={closeCitationsSidebar}
                onViewPdf={openPdfViewer}
            />
            {/* PDF Citation Panel */}
            <PdfCitationPanel
                target={pdfViewerTarget}
                sources={openCitationsIndex !== null && messages[openCitationsIndex] ? getSourcesFromContent(messages[openCitationsIndex].content) : (messages.length > 0 ? getSourcesFromContent(messages[messages.length - 1].content) : [])}
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
