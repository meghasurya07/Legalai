"use client"

import { useState, useEffect, useRef } from 'react'
import { Search, BookMarked, FileText, BookOpen, Shield, Play, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PickerPrompt {
    id: string; title: string; content: string; type: string
    category: string; usage_count: number; is_pinned: boolean
    variables: { name: string; label: string; type: string; required: boolean; defaultValue?: string; options?: string[] }[]
}

interface PromptLibraryPickerProps {
    onSelect: (prompt: PickerPrompt) => void
    onClose: () => void
}

const TYPE_ICONS: Record<string, React.ElementType> = { prompt: FileText, example: BookOpen, playbook: Shield }

export function PromptLibraryPicker({ onSelect, onClose }: PromptLibraryPickerProps) {
    const [prompts, setPrompts] = useState<PickerPrompt[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        async function load() {
            try {
                const params = new URLSearchParams({ sort: 'popular' })
                if (search) params.set('search', search)
                const r = await fetch(`/api/prompt-library?${params}`)
                if (r.ok) setPrompts(await r.json())
            } catch { /* ignore */ }
            finally { setLoading(false) }
        }
        const t = setTimeout(load, search ? 300 : 0)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [onClose])

    const display = prompts.slice(0, 6)

    return (
        <div ref={ref} className="absolute bottom-full mb-2 left-0 w-80 bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 z-50">
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BookMarked className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-muted-foreground">Prompt Library</span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3 w-3" /></Button>
            </div>
            <div className="px-3 py-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="h-7 pl-7 text-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
                {loading ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">Loading...</div>
                ) : display.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">No prompts found</div>
                ) : (
                    display.map(p => {
                        const Icon = TYPE_ICONS[p.type] || FileText
                        return (
                            <button
                                key={p.id}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                                onClick={() => onSelect(p)}
                            >
                                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{p.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{p.category} • {p.usage_count} uses</p>
                                </div>
                                <Play className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100" />
                            </button>
                        )
                    })
                )}
            </div>
            {prompts.length > 6 && (
                <div className="px-3 py-2 border-t text-center">
                    <a href="/prompt-library" className="text-[11px] text-primary hover:underline">
                        View all {prompts.length} prompts →
                    </a>
                </div>
            )}
        </div>
    )
}
