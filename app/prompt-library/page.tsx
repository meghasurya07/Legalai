"use client"

import * as React from "react"
import {
    Search, Plus, BookMarked, FileText, BookOpen, Sparkles, Pin,
    MoreHorizontal, Copy, Trash2, Edit3, Play, X, Shield
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

interface PromptVariable {
    name: string; label: string; type: 'text' | 'select' | 'file'
    required: boolean; defaultValue?: string; options?: string[]
}
interface PlaybookRule {
    id: string; clauseName: string; standardPosition: string
    redLine: string; fallbackPosition: string; action: string
}
interface PromptItem {
    id: string; title: string; content: string; description: string | null
    category: string; type: string; access_level: string; tags: string[]
    variables: PromptVariable[]; rules: PlaybookRule[]
    source_references: unknown[]; example_input: string | null; example_output: string | null
    user_id: string; org_id: string | null; created_by_name: string | null
    is_pinned: boolean; usage_count: number; last_used_at: string | null
    created_at: string; updated_at: string
}

const CATEGORIES = ['All', 'General', 'M&A', 'Litigation', 'Corporate', 'Compliance', 'Employment', 'IP', 'Real Estate', 'Tax', 'Regulatory']
const TABS = [
    { id: 'all', label: 'All' }, { id: 'my', label: 'My Saved' },
    { id: 'shared', label: 'Shared' }, { id: 'examples', label: 'Examples' },
    { id: 'playbooks', label: 'Playbooks' },
]
const TYPE_ICONS: Record<string, React.ElementType> = { prompt: FileText, example: BookOpen, playbook: Shield }
const TYPE_COLORS: Record<string, string> = {
    prompt: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    example: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    playbook: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
}

function timeAgo(d: string | null) {
    if (!d) return 'Never'
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`
    return new Date(d).toLocaleDateString()
}

export default function PromptLibraryPage() {
    const [prompts, setPrompts] = React.useState<PromptItem[]>([])
    const [loading, setLoading] = React.useState(true)
    const [tab, setTab] = React.useState('all')
    const [category, setCategory] = React.useState('All')
    const [search, setSearch] = React.useState('')
    const [sort, setSort] = React.useState('popular')
    const [showCreate, setShowCreate] = React.useState(false)
    const [editPrompt, setEditPrompt] = React.useState<PromptItem | null>(null)
    const [usePrompt, setUsePrompt] = React.useState<PromptItem | null>(null)

    const fetchPrompts = React.useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ tab, sort })
            if (category !== 'All') params.set('category', category)
            if (search) params.set('search', search)
            const res = await fetch(`/api/prompt-library?${params}`)
            if (!res.ok) throw new Error()
            setPrompts(await res.json())
        } catch { toast.error('Failed to load prompts') }
        finally { setLoading(false) }
    }, [tab, category, search, sort])

    React.useEffect(() => { fetchPrompts() }, [fetchPrompts])

    const handleDuplicate = async (id: string) => {
        try {
            const r = await fetch(`/api/prompt-library/${id}/duplicate`, { method: 'POST' })
            if (!r.ok) throw new Error()
            toast.success('Prompt duplicated')
            fetchPrompts()
        } catch { toast.error('Failed to duplicate') }
    }

    const handleDelete = async (id: string) => {
        try {
            const r = await fetch(`/api/prompt-library/${id}`, { method: 'DELETE' })
            if (!r.ok) throw new Error()
            toast.success('Prompt deleted')
            fetchPrompts()
        } catch { toast.error('Failed to delete') }
    }

    const handleUse = async (prompt: PromptItem) => {
        try {
            await fetch(`/api/prompt-library/${prompt.id}/use`, { method: 'POST' })
            setUsePrompt(prompt)
        } catch { setUsePrompt(prompt) }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-24">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="h-8 w-1 rounded-full bg-primary" />
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Prompt Library</h1>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-2xl">
                            Reusable prompts, examples, and playbooks to standardize AI output across your team.
                        </p>
                    </div>

                    {/* Search + Create */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search prompts..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <Button onClick={() => { setEditPrompt(null); setShowCreate(true) }} className="gap-1.5 h-9">
                            <Plus className="h-4 w-4" /> Create New
                        </Button>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 mb-4 border-b">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`px-3.5 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-6">
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={sort} onValueChange={setSort}>
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="popular">Most Used</SelectItem>
                                <SelectItem value="recent">Most Recent</SelectItem>
                                <SelectItem value="alpha">A–Z</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1,2,3,4,5,6].map(i => (
                                <div key={i} className="border rounded-xl p-5 space-y-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : prompts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
                                <BookMarked className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No Prompts Yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                                {tab === 'all' ? 'Get started by creating your first prompt or seeding the library.' : 'No prompts found in this category.'}
                            </p>
                            <div className="flex gap-3">
                                <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create Prompt</Button>
                                {tab === 'all' && (
                                    <Button variant="outline" onClick={async () => {
                                        try {
                                            const r = await fetch('/api/prompt-library/seed', { method: 'POST' })
                                            if (!r.ok) throw new Error()
                                            toast.success('Library seeded!')
                                            fetchPrompts()
                                        } catch { toast.error('Failed to seed') }
                                    }}>
                                        <Sparkles className="h-4 w-4 mr-1" /> Seed Starter Prompts
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {prompts.map(p => {
                                const Icon = TYPE_ICONS[p.type] || FileText
                                const color = TYPE_COLORS[p.type] || TYPE_COLORS.prompt
                                return (
                                    <div key={p.id} className="group relative rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-border hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5">
                                        {/* Pin badge */}
                                        {p.is_pinned && <Pin className="absolute top-3 right-3 h-3.5 w-3.5 text-amber-500" />}

                                        {/* Icon + Title */}
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${color}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{p.title}</h3>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.category}</span>
                                                    {p.type !== 'prompt' && (
                                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 capitalize">{p.type}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
                                            {p.description || p.content.substring(0, 120) + '...'}
                                        </p>

                                        {/* Meta */}
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 mb-3">
                                            <span>by {p.created_by_name || 'Unknown'}</span>
                                            <span>Used {p.usage_count}× • {timeAgo(p.last_used_at)}</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5">
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => handleUse(p)}>
                                                <Play className="h-3 w-3" /> Use
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditPrompt(p); setShowCreate(true) }}>
                                                <Edit3 className="h-3 w-3" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleDuplicate(p.id)}><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showCreate && (
                <CreateEditModal
                    prompt={editPrompt}
                    onClose={() => { setShowCreate(false); setEditPrompt(null) }}
                    onSaved={() => { setShowCreate(false); setEditPrompt(null); fetchPrompts() }}
                />
            )}

            {/* Use Prompt Modal */}
            {usePrompt && (
                <UsePromptDialog
                    prompt={usePrompt}
                    onClose={() => setUsePrompt(null)}
                />
            )}
        </div>
    )
}

/* ─── Create / Edit Modal ─── */
function CreateEditModal({ prompt, onClose, onSaved }: { prompt: PromptItem | null; onClose: () => void; onSaved: () => void }) {
    const isEdit = !!prompt
    const [title, setTitle] = React.useState(prompt?.title || '')
    const [content, setContent] = React.useState(prompt?.content || '')
    const [description, setDescription] = React.useState(prompt?.description || '')
    const [cat, setCat] = React.useState(prompt?.category || 'General')
    const [type, setType] = React.useState(prompt?.type || 'prompt')
    const [accessLevel, setAccessLevel] = React.useState(prompt?.access_level || 'private')
    const [tagsInput, setTagsInput] = React.useState((prompt?.tags || []).join(', '))
    const [variables, setVariables] = React.useState<PromptVariable[]>(prompt?.variables || [])
    const [rules, setRules] = React.useState<PlaybookRule[]>(prompt?.rules || [])
    const [saving, setSaving] = React.useState(false)

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) { toast.error('Title and content required'); return }
        setSaving(true)
        try {
            const body = {
                title: title.trim(), content: content.trim(), description: description.trim() || null,
                category: cat, type, access_level: accessLevel,
                tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
                variables, rules: type === 'playbook' ? rules : [],
            }
            const url = isEdit ? `/api/prompt-library/${prompt!.id}` : '/api/prompt-library'
            const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (!res.ok) throw new Error()
            toast.success(isEdit ? 'Prompt updated' : 'Prompt created')
            onSaved()
        } catch { toast.error('Failed to save') }
        finally { setSaving(false) }
    }

    const addVariable = () => setVariables(v => [...v, { name: '', label: '', type: 'text', required: false }])
    const removeVariable = (i: number) => setVariables(v => v.filter((_, idx) => idx !== i))
    const updateVariable = (i: number, field: string, val: unknown) => setVariables(v => v.map((vr, idx) => idx === i ? { ...vr, [field]: val } : vr))

    const addRule = () => setRules(r => [...r, { id: `r${Date.now()}`, clauseName: '', standardPosition: '', redLine: '', fallbackPosition: '', action: 'flag' }])
    const removeRule = (i: number) => setRules(r => r.filter((_, idx) => idx !== i))
    const updateRule = (i: number, field: string, val: string) => setRules(r => r.map((ru, idx) => idx === i ? { ...ru, [field]: val } : ru))

    return (
        <Dialog open onOpenChange={() => onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Prompt' : 'Create New Prompt'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. NDA Clause Review" /></div>
                        <div><Label>Category</Label>
                            <Select value={cat} onValueChange={setCat}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{CATEGORIES.filter(c => c !== 'All').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief explanation..." /></div>
                    <div><Label>Instruction *</Label>
                        <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your prompt... Use {{variable_name}} for dynamic fields." className="min-h-[120px]" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div><Label>Type</Label>
                            <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="prompt">Prompt</SelectItem><SelectItem value="example">Example</SelectItem><SelectItem value="playbook">Playbook</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div><Label>Visibility</Label>
                            <Select value={accessLevel} onValueChange={setAccessLevel}><SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="organization">Organization</SelectItem><SelectItem value="global">Global</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div><Label>Tags</Label><Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="comma, separated" /></div>
                    </div>

                    {/* Variables */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Variables</Label>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addVariable}><Plus className="h-3 w-3 mr-1" /> Add Variable</Button>
                        </div>
                        {variables.map((v, i) => (
                            <div key={i} className="flex items-center gap-2 mb-2">
                                <Input className="h-8 text-xs" placeholder="name" value={v.name} onChange={e => updateVariable(i, 'name', e.target.value)} />
                                <Input className="h-8 text-xs" placeholder="label" value={v.label} onChange={e => updateVariable(i, 'label', e.target.value)} />
                                <Select value={v.type} onValueChange={val => updateVariable(i, 'type', val)}>
                                    <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="select">Select</SelectItem><SelectItem value="file">File</SelectItem></SelectContent>
                                </Select>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeVariable(i)}><X className="h-3 w-3" /></Button>
                            </div>
                        ))}
                    </div>

                    {/* Playbook Rules */}
                    {type === 'playbook' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Playbook Rules</Label>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addRule}><Plus className="h-3 w-3 mr-1" /> Add Rule</Button>
                            </div>
                            {rules.map((r, i) => (
                                <div key={r.id} className="border rounded-lg p-3 mb-2 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Input className="h-8 text-xs flex-1" placeholder="Clause Name" value={r.clauseName} onChange={e => updateRule(i, 'clauseName', e.target.value)} />
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRule(i)}><X className="h-3 w-3" /></Button>
                                    </div>
                                    <Input className="h-8 text-xs" placeholder="Standard Position" value={r.standardPosition} onChange={e => updateRule(i, 'standardPosition', e.target.value)} />
                                    <Input className="h-8 text-xs" placeholder="Red Line (never accept)" value={r.redLine} onChange={e => updateRule(i, 'redLine', e.target.value)} />
                                    <Input className="h-8 text-xs" placeholder="Fallback Position" value={r.fallbackPosition} onChange={e => updateRule(i, 'fallbackPosition', e.target.value)} />
                                    <Select value={r.action} onValueChange={val => updateRule(i, 'action', val)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="flag">Flag</SelectItem><SelectItem value="suggest_redline">Suggest Redline</SelectItem><SelectItem value="insert_clause">Insert Clause</SelectItem></SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Prompt'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/* ─── Use Prompt Dialog ─── */
function UsePromptDialog({ prompt, onClose }: { prompt: PromptItem; onClose: () => void }) {
    const [editedContent, setEditedContent] = React.useState(prompt.content)
    const [varValues, setVarValues] = React.useState<Record<string, string>>(() => {
        const vals: Record<string, string> = {}
        for (const v of prompt.variables || []) vals[v.name] = v.defaultValue || ''
        return vals
    })

    const resolvedContent = React.useMemo(() => {
        let c = editedContent
        for (const [k, v] of Object.entries(varValues)) {
            c = c.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`)
        }
        return c
    }, [editedContent, varValues])

    const copyToClipboard = () => { navigator.clipboard.writeText(resolvedContent); toast.success('Copied to clipboard'); onClose() }

    return (
        <Dialog open onOpenChange={() => onClose()}>
            <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Use: {prompt.title}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label>Instruction (editable)</Label>
                        <Textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} className="min-h-[140px] text-sm" />
                    </div>
                    {prompt.variables && prompt.variables.length > 0 && (
                        <div>
                            <Label className="mb-2 block">Variables</Label>
                            {prompt.variables.map(v => (
                                <div key={v.name} className="flex items-center gap-3 mb-2">
                                    <span className="text-sm text-muted-foreground w-32 shrink-0">{v.label || v.name}:</span>
                                    {v.type === 'select' && v.options ? (
                                        <Select value={varValues[v.name] || ''} onValueChange={val => setVarValues(prev => ({ ...prev, [v.name]: val }))}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                                            <SelectContent>{v.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                        </Select>
                                    ) : (
                                        <Input className="h-8 text-xs" value={varValues[v.name] || ''} onChange={e => setVarValues(prev => ({ ...prev, [v.name]: e.target.value }))} placeholder={v.defaultValue || `Enter ${v.label || v.name}...`} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {prompt.type === 'example' && prompt.example_output && (
                        <div>
                            <Label>Expected Output (reference)</Label>
                            <div className="mt-1 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">{prompt.example_output}</div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={copyToClipboard} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Copy & Use</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
