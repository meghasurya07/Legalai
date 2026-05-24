"use client"

import { getCategoryMeta, type PromptItem } from "@/components/chat/category-meta"

interface SlashAutocompleteProps {
    prompts: PromptItem[]
    selectedIdx: number
    onSelect: (prompt: PromptItem) => void
}

export function SlashAutocomplete({ prompts, selectedIdx, onSelect }: SlashAutocompleteProps) {
    if (prompts.length === 0) return null

    return (
        <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto md:left-10 mb-3 z-50 sm:w-80 bg-card border border-border/60 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-h-60 sm:max-h-72 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="px-2.5 py-2 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest border-b border-border/50 mb-1.5 flex justify-between items-center">
                <span>Legal Templates</span>
                <span>{prompts.length} matching</span>
            </div>
            {prompts.map((prompt, idx) => {
                const meta = getCategoryMeta(prompt.category)
                const Icon = meta.icon
                return (
                    <button
                        key={prompt.id}
                        type="button"
                        onClick={() => onSelect(prompt)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-3 ${idx === selectedIdx ? "bg-muted/90 text-foreground font-medium shadow-sm scale-[0.99]" : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"}`}
                    >
                        <div className={`p-1.5 rounded-lg shrink-0 ${meta.color.split(" ")[1]} ${meta.color.split(" ")[0]}`}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-foreground truncate">{prompt.title}</span>
                                <span className="text-[9px] px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground shrink-0">{meta.label}</span>
                            </div>
                            {prompt.description && (
                                <span className="text-[10px] opacity-75 line-clamp-1 mt-0.5">{prompt.description}</span>
                            )}
                        </div>
                    </button>
                )
            })}
        </div>
    )
}
