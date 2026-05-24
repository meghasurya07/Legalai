"use client"

import * as React from "react"
import { BookOpen, Search, X, Wand2, Sparkles, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { getCategoryMeta, type PromptItem } from "@/components/chat/category-meta"

// ─── Constants ───────────────────────────────────────────────────

const CATEGORY_TABS = ["All", "Corporate", "Litigation", "Contracts", "Compliance"] as const

// ─── Sub-component: Variable Preview ────────────────────────────

function TemplatePreview({
    content,
    variables,
}: {
    content: string
    variables: Record<string, string>
}) {
    const parts: React.ReactNode[] = []
    let lastIdx = 0
    const regex = /\{\{([^}]+)\}\}/g
    let match
    let keyIdx = 0

    while ((match = regex.exec(content)) !== null) {
        const start = match.index
        const end = regex.lastIndex
        const varName = match[1]
        const varValue = variables[varName] || `{{${varName}}}`

        if (start > lastIdx) {
            parts.push(content.substring(lastIdx, start))
        }

        parts.push(
            <span
                key={keyIdx++}
                className={`px-1 rounded border text-[10px] font-semibold transition-all ${
                    variables[varName]
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                }`}
            >
                {varValue}
            </span>
        )
        lastIdx = end
    }

    if (lastIdx < content.length) {
        parts.push(content.substring(lastIdx))
    }

    return <>{parts.length > 0 ? parts : content}</>
}

// ─── Main Component ─────────────────────────────────────────────

interface PromptPopoverProps {
    prompts: PromptItem[]
    isLoading: boolean
    onInsert: (content: string) => void
}

export function PromptPopover({ prompts, isLoading, onInsert }: PromptPopoverProps) {
    const [search, setSearch] = React.useState("")
    const [category, setCategory] = React.useState("All")
    const [selected, setSelected] = React.useState<PromptItem | null>(null)
    const [variables, setVariables] = React.useState<Record<string, string>>({})

    // Filter prompts by search + category
    const filtered = React.useMemo(() => {
        return prompts.filter((p) => {
            const matchesSearch =
                p.title.toLowerCase().includes(search.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
            if (category === "All") return matchesSearch
            const meta = getCategoryMeta(p.category)
            return meta.label.toLowerCase() === category.toLowerCase() && matchesSearch
        })
    }, [prompts, search, category])

    // Auto-select first prompt when filter changes
    React.useEffect(() => {
        if (filtered.length > 0) {
            setSelected((prev) => {
                if (prev && filtered.some((p) => p.id === prev.id)) return prev
                return filtered[0]
            })
        } else {
            setSelected(null)
        }
    }, [filtered])

    // Parse variable placeholders when selection changes
    React.useEffect(() => {
        if (selected) {
            const matches = Array.from(selected.content.matchAll(/\{\{([^}]+)\}\}/g))
            const vars = Array.from(new Set(matches.map((m) => m[1])))
            const initial: Record<string, string> = {}
            vars.forEach((v) => { initial[v] = "" })
            setVariables(initial)
        } else {
            setVariables({})
        }
    }, [selected])

    const handleInsert = () => {
        if (!selected) return
        let finalContent = selected.content
        Object.keys(variables).forEach((v) => {
            const placeholder = `{{${v}}}`
            const val = variables[v].trim() || placeholder
            finalContent = finalContent.replaceAll(placeholder, val)
        })
        onInsert(finalContent)
    }

    if (isLoading || prompts.length === 0) return null

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 px-2 md:px-3">
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden md:inline">Prompts</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[95vw] sm:w-[440px] md:w-[740px] max-w-[95vw] p-0 rounded-2xl overflow-hidden border border-border/60 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)] bg-card"
                align="start"
            >
                {/* Header */}
                <div className="p-3 sm:p-4 border-b bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div>
                        <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4 text-primary" />
                            Prompt Directory
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Customize and inject premium legal templates instantly
                        </p>
                    </div>
                    <div className="relative w-full sm:w-48 md:w-56 shrink-0">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search templates..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8.5 pl-8 pr-7 text-xs bg-background/50 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-ring/25"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                                aria-label="Clear search"
                                title="Clear search"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Split Body */}
                <div className="grid grid-cols-1 md:grid-cols-12 h-[50vh] sm:h-[55vh] md:h-[400px] max-h-[400px] overflow-hidden">
                    {/* LEFT: List & Filters */}
                    <div className={`col-span-1 md:col-span-5 border-r border-border/50 flex flex-col h-full overflow-hidden bg-muted/5 ${selected ? "hidden md:flex" : "flex"}`}>
                        {/* Category Tabs */}
                        <div className="flex gap-1.5 p-2 overflow-x-auto no-scrollbar border-b border-border/40 shrink-0 bg-background/30">
                            {CATEGORY_TABS.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-all shrink-0 ${
                                        category === cat
                                            ? "bg-primary text-primary-foreground font-semibold"
                                            : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Prompt List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-muted">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                    <Info className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                    <span className="text-[11px] font-medium text-muted-foreground">No prompts found</span>
                                </div>
                            ) : (
                                filtered.map((prompt) => {
                                    const meta = getCategoryMeta(prompt.category)
                                    const Icon = meta.icon
                                    const isSelected = selected?.id === prompt.id
                                    return (
                                        <button
                                            key={prompt.id}
                                            type="button"
                                            onClick={() => setSelected(prompt)}
                                            className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start gap-2.5 border ${
                                                isSelected
                                                    ? "bg-card border-primary/20 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                                                    : "bg-transparent border-transparent hover:bg-muted/50 text-muted-foreground"
                                            }`}
                                        >
                                            <div
                                                className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                                                    isSelected
                                                        ? meta.color.split(" ")[1] + " " + meta.color.split(" ")[0]
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className={`text-[11px] font-semibold truncate ${isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                                                        {prompt.title}
                                                    </span>
                                                </div>
                                                {prompt.description && (
                                                    <p className="text-[10px] leading-relaxed line-clamp-2 mt-0.5 text-muted-foreground/80">
                                                        {prompt.description}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Detail & Variables */}
                    <div className={`col-span-1 md:col-span-7 flex flex-col h-full overflow-hidden bg-card ${selected ? "flex" : "hidden md:flex"}`}>
                        {selected ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-muted">
                                    {/* Mobile back */}
                                    <button
                                        type="button"
                                        onClick={() => setSelected(null)}
                                        className="md:hidden flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground mb-1 transition-colors"
                                    >
                                        <span>←</span> Back to templates
                                    </button>

                                    {/* Metadata header */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                                {selected.type || "Prompt"}
                                            </span>
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                            <span className="text-[10px] text-primary bg-primary/10 border border-primary/10 px-1.5 py-0.5 rounded-full font-medium">
                                                {getCategoryMeta(selected.category).label}
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-sm text-foreground mt-1">{selected.title}</h4>
                                        {selected.description && (
                                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">{selected.description}</p>
                                        )}
                                    </div>

                                    <hr className="border-border/40" />

                                    {/* Variable inputs */}
                                    {Object.keys(variables).length > 0 ? (
                                        <div className="space-y-3.5">
                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                <Wand2 className="h-3 w-3 text-primary animate-pulse" />
                                                Template Parameters
                                            </div>
                                            <div className="grid gap-3">
                                                {Object.keys(variables).map((v) => {
                                                    const label = v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                                                    return (
                                                        <div key={v} className="space-y-1">
                                                            <label className="text-[10px] font-medium text-foreground">{label}</label>
                                                            <Input
                                                                type="text"
                                                                placeholder={`Value for {{${v}}}`}
                                                                value={variables[v]}
                                                                onChange={(e) =>
                                                                    setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                                                                }
                                                                className="h-8 text-xs bg-background border-border/60 rounded-md focus-visible:ring-1 focus-visible:ring-ring/20"
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-muted/15 border border-border/45 rounded-xl p-3 flex items-start gap-2.5 text-muted-foreground text-[10px] leading-relaxed">
                                            <Info className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
                                            This prompt template does not require any parameters and is ready to insert.
                                        </div>
                                    )}

                                    {/* Live Preview */}
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            Template Text Preview
                                        </div>
                                        <div className="bg-muted/30 border border-border/40 rounded-xl p-3 text-[10.5px] leading-relaxed text-foreground/80 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                            <TemplatePreview content={selected.content} variables={variables} />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-2.5 sm:p-3 border-t bg-muted/15 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
                                    <a
                                        href="/prompt-library"
                                        className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1.5"
                                    >
                                        Open Library
                                        <span className="opacity-60 font-normal">→</span>
                                    </a>
                                    <Button size="sm" className="gap-1.5 h-8.5 rounded-lg text-xs font-semibold px-4" onClick={handleInsert}>
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Use Template
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                <Info className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <span className="text-[11px] font-medium text-muted-foreground">Select a template</span>
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
