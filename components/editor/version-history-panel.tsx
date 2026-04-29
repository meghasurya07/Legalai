"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Clock, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Version {
    id: string
    draft_id: string
    word_count: number
    version_number: number
    change_summary: string
    created_by: string
    created_at: string
}

interface VersionHistoryPanelProps {
    draftId: string
    isOpen: boolean
    activePreviewId?: string | null
    onClose: () => void
    onRestore: (versionId: string) => void
    onPreview: (versionId: string) => void
}

export function VersionHistoryPanel({ draftId, isOpen, activePreviewId, onClose, onRestore, onPreview }: VersionHistoryPanelProps) {
    const [versions, setVersions] = useState<Version[]>([])
    const [loading, setLoading] = useState(false)
    const [restoring, setRestoring] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen || !draftId) return

        const fetchVersions = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/drafts/${draftId}/versions`)
                if (res.ok) {
                    const data = await res.json()
                    setVersions(data.versions || [])
                }
            } catch {
                toast.error('Failed to load version history')
            } finally {
                setLoading(false)
            }
        }

        fetchVersions()
    }, [isOpen, draftId])

    const handleRestore = async (versionId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setRestoring(versionId)
        try {
            await onRestore(versionId)
            toast.success('Restored version')
            onClose()
        } catch {
            toast.error('Failed to restore version')
        } finally {
            setRestoring(null)
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
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    if (!isOpen) return null

    return (
        <div className="w-80 border-l bg-background flex flex-col h-full shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Version History</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : versions.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <Clock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">No saved versions yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Versions are created when you manually save
                        </p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {versions.map((version) => {
                            const isActive = activePreviewId === version.id
                            return (
                                <div
                                    key={version.id}
                                    onClick={() => onPreview(version.id)}
                                    className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                                        isActive ? 'bg-primary/10 border-primary/20 border' : 'hover:bg-muted/50 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                                                Version {version.version_number}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {formatDate(version.created_at)}
                                            </p>
                                            {version.change_summary && (
                                                <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                                                    {version.change_summary}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                                {version.word_count} words
                                            </p>
                                        </div>
                                        <Button
                                            variant={isActive ? "default" : "ghost"}
                                            size="sm"
                                            className={`h-7 px-2 transition-opacity text-xs gap-1 ${
                                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                            onClick={(e) => handleRestore(version.id, e)}
                                            disabled={!!restoring}
                                        >
                                        {restoring === version.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <RotateCcw className="h-3 w-3" />
                                        )}
                                        Restore
                                    </Button>
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>
        </div>
    )
}
