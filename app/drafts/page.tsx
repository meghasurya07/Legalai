"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    FileEdit, Plus, Search, Loader2, FileText, Clock,
    MoreVertical, Trash2, Download, Upload,
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { DraftDocumentType, DraftStatus } from '@/types'

interface DraftListItem {
    id: string
    title: string
    document_type: DraftDocumentType
    word_count: number
    status: DraftStatus
    updated_at: string
    created_at: string
    project_id?: string | null
}

const TYPE_LABELS: Record<DraftDocumentType, string> = {
    general: 'General',
    contract: 'Contract',
    memo: 'Memo',
    brief: 'Brief',
    letter: 'Letter',
    motion: 'Motion',
}

const TYPE_COLORS: Record<DraftDocumentType, string> = {
    general: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    contract: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    memo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    brief: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    letter: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    motion: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUS_COLORS: Record<DraftStatus, string> = {
    draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    final: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

export default function DraftsPage() {
    const router = useRouter()
    const [drafts, setDrafts] = useState<DraftListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)

    const fetchDrafts = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (statusFilter !== 'all') params.set('status', statusFilter)
            if (typeFilter !== 'all') params.set('documentType', typeFilter)

            const res = await fetch(`/api/drafts?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setDrafts(data.drafts || [])
            }
        } catch {
            toast.error('Failed to load drafts')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDrafts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, typeFilter])

    useEffect(() => {
        const timer = setTimeout(fetchDrafts, 300)
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    const createDraft = async () => {
        setCreating(true)
        try {
            const res = await fetch('/api/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Untitled Document' }),
            })
            if (res.ok) {
                const data = await res.json()
                router.push(`/drafts/${data.draft.id}`)
            } else {
                toast.error('Failed to create draft')
            }
        } catch {
            toast.error('Failed to create draft')
        } finally {
            setCreating(false)
        }
    }


    const handleDocxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImporting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const importRes = await fetch('/api/drafts/import', {
                method: 'POST',
                body: formData,
            })

            if (!importRes.ok) {
                const err = await importRes.json().catch(() => ({}))
                throw new Error(err.error || 'Import failed')
            }

            const imported = await importRes.json()

            // Create a draft with the imported content
            const draftRes = await fetch('/api/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: imported.title || 'Imported Document',
                    content: imported.content,
                    contentText: imported.plainText,
                    wordCount: imported.wordCount,
                }),
            })

            if (draftRes.ok) {
                const data = await draftRes.json()
                toast.success('Document imported successfully')
                router.push(`/drafts/${data.draft.id}`)
            } else {
                toast.error('Failed to create draft from imported document')
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to import document')
        } finally {
            setImporting(false)
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const deleteDraft = async (id: string) => {
        try {
            const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setDrafts(prev => prev.filter(d => d.id !== id))
                toast.success('Draft deleted')
            }
        } catch {
            toast.error('Failed to delete draft')
        }
    }

    const exportDraft = async (id: string, title: string) => {
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

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        const days = Math.floor(hrs / 24)
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <FileEdit className="h-5 w-5 text-white" />
                            </div>
                            Document Drafts
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Create, edit, and manage your legal documents
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Import DOCX */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".docx"
                            onChange={handleDocxImport}
                            className="hidden"
                            title="Import DOCX"
                            aria-label="Import DOCX"
                        />
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="gap-2"
                        >
                            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Import DOCX
                        </Button>


                        {/* Blank Draft */}
                        <Button onClick={createDraft} disabled={creating} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            New Draft
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search drafts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="final">Final</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="memo">Memo</SelectItem>
                            <SelectItem value="brief">Brief</SelectItem>
                            <SelectItem value="letter">Letter</SelectItem>
                            <SelectItem value="motion">Motion</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Drafts List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed rounded-2xl">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground">No drafts yet</h3>
                        <p className="text-sm text-muted-foreground/70 mt-1 mb-6">
                            Create your first document draft to get started
                        </p>
                        <Button onClick={createDraft} disabled={creating} variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Draft
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {drafts.map((draft) => (
                            <div
                                key={draft.id}
                                onClick={() => router.push(`/drafts/${draft.id}`)}
                                className="group flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 hover:border-primary/20 transition-all cursor-pointer"
                            >
                                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                    <FileEdit className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-medium truncate">{draft.title}</h3>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${TYPE_COLORS[draft.document_type] || TYPE_COLORS.general}`}>
                                            {TYPE_LABELS[draft.document_type] || 'General'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[draft.status] || STATUS_COLORS.draft}`}>
                                            {draft.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(draft.updated_at)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {draft.word_count.toLocaleString()} words
                                        </span>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); exportDraft(draft.id, draft.title) }}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Export DOCX
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id) }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
