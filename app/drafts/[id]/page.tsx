"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft, Download, Clock, Sparkles, Loader2, Save, Check,
    MoreVertical, Trash2, ShieldAlert, CheckCheck, XCircle,
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { PlateEditor, type PlateEditorHandle } from '@/components/editor/plate-editor'
import { VersionHistoryPanel } from '@/components/editor/version-history-panel'
import { AIChatPanel } from '@/components/editor/ai-chat-panel'
import { SlashCommandMenu } from '@/components/editor/slash-command-menu'
import { AICommandDialog } from '@/components/editor/ai-command-dialog'
import { RedlinePanel } from '@/components/editor/redline-panel'
import { GhostTextOverlay } from '@/components/editor/ghost-text-overlay'
import { useGhostText } from '@/components/editor/use-ghost-text'
import { useSuggestions } from '@/components/editor/use-suggestions'
import { SuggestionPopover } from '@/components/editor/suggestion-popover'
import type { DraftDocumentType, DraftStatus } from '@/types'

interface DraftData {
    id: string
    title: string
    content: unknown[]
    content_text: string
    document_type: DraftDocumentType
    word_count: number
    status: DraftStatus
    project_id?: string | null
    updated_at: string
}

export default function DraftEditorPage() {
    const params = useParams()
    const router = useRouter()
    const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)

    const [draft, setDraft] = useState<DraftData | null>(null)
    const [loading, setLoading] = useState(true)
    const [title, setTitle] = useState('')
    const [wordCount, setWordCount] = useState(0)
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
    const [showVersions, setShowVersions] = useState(false)
    const [showAIChat, setShowAIChat] = useState(false)
    const [documentType, setDocumentType] = useState<DraftDocumentType>('general')
    const [draftStatus, setDraftStatus] = useState<DraftStatus>('draft')
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 })
    const [showCommandDialog, setShowCommandDialog] = useState(false)
    const [activeCommand, setActiveCommand] = useState({ id: '', label: '' })
    const [selectedText, setSelectedText] = useState('')
    const [plainText, setPlainText] = useState('')
    const [showRedline, setShowRedline] = useState(false)
    
    // Preview state
    const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)
    const [previewContent, setPreviewContent] = useState<unknown[] | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    // Ghost text (AI autocomplete)
    const ghostText = useGhostText({
        editor: null, // We don't need the Plate editor reference for DOM-based approach
        documentType,
        enabled: true,
    })

    const lastSavedRef = useRef<string>('')
    const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const editorRef = useRef<PlateEditorHandle>(null)

    // Inline AI suggestions
    const {
        suggestions,
        activeSuggestionId,
        setActiveSuggestionId,
        createSuggestion,
        acceptSuggestion,
        rejectSuggestion,
        acceptAll,
        rejectAll,
        pendingCount,
    } = useSuggestions()
    const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false)

    // Fetch draft on mount
    useEffect(() => {
        if (!id) return
        const fetchDraft = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/drafts/${id}`)
                if (!res.ok) {
                    toast.error('Draft not found')
                    router.push('/drafts')
                    return
                }
                const data = await res.json()
                const d = data.draft
                setDraft(d)
                setTitle(d.title)
                setWordCount(d.word_count || 0)
                setDocumentType(d.document_type || 'general')
                setDraftStatus(d.status || 'draft')
                setPlainText(d.content_text || '')
                lastSavedRef.current = JSON.stringify(d.content)
            } catch {
                toast.error('Failed to load draft')
                router.push('/drafts')
            } finally {
                setLoading(false)
            }
        }
        fetchDraft()
    }, [id, router])

    // Autosave content
    const handleContentChange = useCallback(async (content: unknown[], contentText: string, wc: number) => {
        setWordCount(wc)
        setPlainText(contentText)

        const contentStr = JSON.stringify(content)
        if (contentStr === lastSavedRef.current) return

        setSaveStatus('saving')
        try {
            const res = await fetch(`/api/drafts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    contentText,
                    wordCount: wc,
                }),
            })
            if (res.ok) {
                lastSavedRef.current = contentStr
                setSaveStatus('saved')
            } else {
                setSaveStatus('unsaved')
            }
        } catch {
            setSaveStatus('unsaved')
        }
    }, [id])

    // Save title
    const handleTitleChange = useCallback((newTitle: string) => {
        setTitle(newTitle)
        if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current)
        titleTimeoutRef.current = setTimeout(async () => {
            try {
                await fetch(`/api/drafts/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle }),
                })
            } catch { /* silent */ }
        }, 1000)
    }, [id])

    // Save document type
    const handleTypeChange = useCallback(async (type: DraftDocumentType) => {
        setDocumentType(type)
        try {
            await fetch(`/api/drafts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentType: type }),
            })
        } catch { /* silent */ }
    }, [id])

    // Save status
    const handleStatusChange = useCallback(async (status: DraftStatus) => {
        setDraftStatus(status)
        try {
            await fetch(`/api/drafts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            toast.success(`Status changed to ${status}`)
        } catch { /* silent */ }
    }, [id])

    // Manual save (create version)
    const handleManualSave = async () => {
        try {
            await fetch(`/api/drafts/${id}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changeSummary: 'Manual save' }),
            })
            toast.success('Version saved')
        } catch {
            toast.error('Failed to save version')
        }
    }

    // Export DOCX
    const handleExport = async () => {
        try {
            const res = await fetch(`/api/drafts/${id}/export`, { method: 'POST' })
            if (!res.ok) throw new Error('Export failed')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${title || 'document'}.docx`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Document exported')
        } catch {
            toast.error('Failed to export')
        }
    }

    // Delete
    const handleDelete = async () => {
        try {
            await fetch(`/api/drafts/${id}`, { method: 'DELETE' })
            toast.success('Draft deleted')
            router.push('/drafts')
        } catch {
            toast.error('Failed to delete')
        }
    }

    // Insert AI content
    const handleAIInsert = useCallback((_text: string) => {
        // This will be enhanced with proper Plate.js API insertion
        // For now it copies to clipboard for the user to paste
        navigator.clipboard.writeText(_text)
        toast.info('Content copied — paste into editor with Ctrl+V')
    }, [])

    // Inline AI suggestion handler — called from floating toolbar
    const handleInlineAICommand = useCallback(async (command: string, commandLabel: string, selText: string) => {
        const editor = editorRef.current?.getEditor()
        if (!editor || !selText.trim()) return

        setIsGeneratingSuggestion(true)

        try {
            const response = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command,
                    selection: selText,
                    prompt: command === 'tone' ? 'formal professional' : '',
                    documentType,
                    context: plainText.substring(0, 3000),
                }),
            })

            if (!response.ok) throw new Error('AI request failed')

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            let fullText = ''
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n')
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(line.slice(6))
                            if (parsed.text) {
                                fullText += parsed.text
                            }
                        } catch { /* skip non-JSON */ }
                    }
                }
            }

            if (fullText.trim()) {
                createSuggestion(editor, fullText.trim(), command, commandLabel)
            } else {
                toast.error('AI returned empty response')
            }
        } catch {
            toast.error('AI suggestion failed')
        } finally {
            setIsGeneratingSuggestion(false)
        }
    }, [documentType, plainText, createSuggestion])

    // Version restore
    const handleVersionRestore = useCallback(async (versionId: string) => {
        try {
            const res = await fetch(`/api/drafts/${id}/versions/${versionId}`)
            if (!res.ok) throw new Error('Failed to fetch version')
            const data = await res.json()
            const versionContent = data.version.content
            const versionText = data.version.content_text
            const wc = data.version.word_count

            // Update main draft
            await fetch(`/api/drafts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: versionContent,
                    contentText: versionText,
                    wordCount: wc,
                }),
            })

            // Update local state and exit preview
            setDraft(prev => prev ? { ...prev, content: versionContent } : null)
            setPlainText(versionText)
            setWordCount(wc)
            setPreviewVersionId(null)
            setPreviewContent(null)
            lastSavedRef.current = JSON.stringify(versionContent)
        } catch {
            throw new Error('Restore failed')
        }
    }, [id])

    // Version preview
    const handlePreview = useCallback(async (versionId: string) => {
        setPreviewLoading(true)
        setPreviewVersionId(versionId)
        try {
            const res = await fetch(`/api/drafts/${id}/versions/${versionId}`)
            if (res.ok) {
                const data = await res.json()
                setPreviewContent(data.version.content)
            } else {
                toast.error('Failed to load version preview')
                setPreviewVersionId(null)
            }
        } catch {
            toast.error('Failed to load version preview')
            setPreviewVersionId(null)
        } finally {
            setPreviewLoading(false)
        }
    }, [id])

    // Slash command handler
    const handleSlashCommand = useCallback((commandId: string, label: string) => {
        setShowSlashMenu(false)
        setActiveCommand({ id: commandId, label })
        const sel = window.getSelection()?.toString() || ''
        setSelectedText(sel)
        setShowCommandDialog(true)
    }, [])

    // Keyboard shortcut: Ctrl+/ to open slash menu
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault()
                const sel = window.getSelection()
                if (sel && sel.rangeCount > 0) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect()
                    setSlashMenuPos({ top: rect.bottom + 8, left: rect.left })
                } else {
                    setSlashMenuPos({ top: 200, left: 400 })
                }
                setShowSlashMenu(true)
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!draft) return null

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/drafts')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>

                <Input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="border-none shadow-none text-base font-semibold h-8 px-2 bg-transparent focus-visible:ring-0 max-w-md"
                    placeholder="Untitled Document"
                />

                <Select value={documentType} onValueChange={(v) => handleTypeChange(v as DraftDocumentType)}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="memo">Memo</SelectItem>
                        <SelectItem value="brief">Brief</SelectItem>
                        <SelectItem value="letter">Letter</SelectItem>
                        <SelectItem value="motion">Motion</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={draftStatus} onValueChange={(v) => handleStatusChange(v as DraftStatus)}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex-1" />

                {/* Save status */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
                    {saveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500" /> Saved</>}
                    {saveStatus === 'unsaved' && <span className="text-amber-500">Unsaved changes</span>}
                </div>

                <span className="text-xs text-muted-foreground tabular-nums">
                    {wordCount.toLocaleString()} words
                </span>

                {/* Suggestion controls */}
                {pendingCount > 0 && (
                    <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border/40">
                        <span className="text-[10px] text-violet-600 font-medium tabular-nums">
                            {pendingCount} suggestion{pendingCount > 1 ? 's' : ''}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:bg-emerald-500/10"
                            onClick={() => {
                                const editor = editorRef.current?.getEditor()
                                if (editor) acceptAll(editor)
                            }}
                        >
                            <CheckCheck className="h-3 w-3" />
                            Accept All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-red-500 hover:bg-red-500/10"
                            onClick={() => {
                                const editor = editorRef.current?.getEditor()
                                if (editor) rejectAll(editor)
                            }}
                        >
                            <XCircle className="h-3 w-3" />
                            Reject All
                        </Button>
                    </div>
                )}

                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleManualSave}>
                    <Save className="h-3.5 w-3.5" />
                    Save Version
                </Button>

                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowVersions(!showVersions)}>
                    <Clock className="h-3.5 w-3.5" />
                    History
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 gap-1.5 text-xs ${showAIChat ? 'bg-violet-500/10 text-violet-600' : ''}`}
                    onClick={() => setShowAIChat(!showAIChat)}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI
                </Button>

                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 gap-1.5 text-xs ${showRedline ? 'bg-red-500/10 text-red-600' : ''}`}
                    onClick={() => setShowRedline(!showRedline)}
                >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Redline
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Draft
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Editor */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {previewVersionId && (
                        <div className="absolute top-0 left-0 right-0 z-10 bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between backdrop-blur-md">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-primary">Previewing Past Version</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => {
                                    setPreviewVersionId(null)
                                    setPreviewContent(null)
                                }} className="h-7 text-xs bg-background/50">
                                    Cancel Preview
                                </Button>
                                <Button size="sm" onClick={() => {
                                    handleVersionRestore(previewVersionId)
                                        .then(() => toast.success('Version restored'))
                                        .catch(() => toast.error('Failed to restore version'))
                                }} className="h-7 text-xs">
                                    Restore This Version
                                </Button>
                            </div>
                        </div>
                    )}
                    
                    {previewLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <PlateEditor
                            ref={editorRef}
                            key={previewVersionId || 'current'}
                            initialContent={previewVersionId && previewContent ? (previewContent as never[]) : (Array.isArray(draft.content) ? (draft.content as never[]) : undefined)}
                            onContentChange={previewVersionId ? undefined : handleContentChange}
                            onAICommand={(pos) => {
                                setSlashMenuPos(pos)
                                setShowSlashMenu(true)
                            }}
                            onInlineAICommand={handleInlineAICommand}
                            documentType={documentType}
                            readOnly={!!previewVersionId}
                        />
                    )}
                    <GhostTextOverlay
                        suggestion={ghostText.suggestion}
                        isLoading={ghostText.isLoading}
                    />
                </div>

                {/* Side panels */}
                <VersionHistoryPanel
                    draftId={id}
                    isOpen={showVersions}
                    activePreviewId={previewVersionId}
                    onClose={() => setShowVersions(false)}
                    onRestore={(versionId) => {
                        handleVersionRestore(versionId)
                            .then(() => toast.success('Version restored'))
                            .catch(() => toast.error('Failed to restore version'))
                    }}
                    onPreview={handlePreview}
                />

                <AIChatPanel
                    isOpen={showAIChat}
                    onClose={() => setShowAIChat(false)}
                    onInsert={handleAIInsert}
                    documentContext={plainText}
                    documentType={documentType}
                />

                <RedlinePanel
                    isOpen={showRedline}
                    onClose={() => setShowRedline(false)}
                    draftText={plainText}
                />
            </div>

            {/* Slash Command Menu */}
            <SlashCommandMenu
                isOpen={showSlashMenu}
                onClose={() => setShowSlashMenu(false)}
                onSelect={handleSlashCommand}
                position={slashMenuPos}
            />

            {/* AI Command Dialog */}
            <AICommandDialog
                isOpen={showCommandDialog}
                command={activeCommand.id}
                commandLabel={activeCommand.label}
                selectedText={selectedText}
                onClose={() => setShowCommandDialog(false)}
                onInsert={handleAIInsert}
                documentType={documentType}
                documentContext={plainText}
            />

            {/* Inline Suggestion Popover */}
            <SuggestionPopover
                suggestions={suggestions}
                activeSuggestionId={activeSuggestionId}
                onAccept={(suggId) => {
                    const editor = editorRef.current?.getEditor()
                    if (editor) acceptSuggestion(editor, suggId)
                }}
                onReject={(suggId) => {
                    const editor = editorRef.current?.getEditor()
                    if (editor) rejectSuggestion(editor, suggId)
                }}
                onAcceptAll={() => {
                    const editor = editorRef.current?.getEditor()
                    if (editor) acceptAll(editor)
                }}
                onRejectAll={() => {
                    const editor = editorRef.current?.getEditor()
                    if (editor) rejectAll(editor)
                }}
                onSetActive={setActiveSuggestionId}
                pendingCount={pendingCount}
                isGenerating={isGeneratingSuggestion}
            />
        </div>
    )
}
