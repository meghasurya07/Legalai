"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, LayoutTemplate, MessageSquare, Loader2, Columns3, Sparkles, RotateCcw } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import type { ReviewColumn } from "./tabular-review-view"

interface TabularReviewToolbarProps {
    columns: ReviewColumn[]
    onAddColumn: (name: string, prompt?: string) => void
    onApplyTemplate: (templateId: string) => void
    onRunAll: () => void
    isRunning: boolean
    isGeneratingColumns?: boolean
    runProgress: { total: number; completed: number }
    chatOpen: boolean
    onToggleChat: () => void
    templates: Record<string, { name: string; columns: Omit<ReviewColumn, "order">[] }>
    documentCount: number
}

export function TabularReviewToolbar({
    columns,
    onAddColumn,
    onApplyTemplate,
    onRunAll,
    isRunning,
    isGeneratingColumns,
    runProgress,
    chatOpen,
    onToggleChat,
    templates,
    documentCount,
}: TabularReviewToolbarProps) {
    const [addColumnOpen, setAddColumnOpen] = useState(false)
    const [templateOpen, setTemplateOpen] = useState(false)
    const [newColumnName, setNewColumnName] = useState("")
    const [newColumnPrompt, setNewColumnPrompt] = useState("")

    const handleAddColumn = () => {
        if (!newColumnName.trim()) return
        onAddColumn(newColumnName.trim(), newColumnPrompt.trim() || undefined)
        setNewColumnName("")
        setNewColumnPrompt("")
        setAddColumnOpen(false)
    }

    const progressPct = runProgress.total > 0
        ? Math.round((runProgress.completed / runProgress.total) * 100)
        : 0

    return (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background/60 backdrop-blur-sm shrink-0">
            {/* Chat toggle */}
            <Button
                variant={chatOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={onToggleChat}
                className="h-8 gap-1.5 text-xs"
            >
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Chat</span>
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Add Columns */}
            <Popover open={addColumnOpen} onOpenChange={setAddColumnOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                        <Plus className="h-3.5 w-3.5" />
                        Add columns
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-4" align="start">
                    <div className="space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold mb-1">Add Column</h4>
                            <p className="text-[11px] text-muted-foreground">
                                Define what to extract from each document
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Input
                                placeholder="Column name (e.g., Royalty Rates)"
                                value={newColumnName}
                                onChange={e => setNewColumnName(e.target.value)}
                                className="h-8 text-sm"
                                onKeyDown={e => e.key === "Enter" && handleAddColumn()}
                            />
                            <Input
                                placeholder="Custom prompt (optional)"
                                value={newColumnPrompt}
                                onChange={e => setNewColumnPrompt(e.target.value)}
                                className="h-8 text-sm"
                                onKeyDown={e => e.key === "Enter" && handleAddColumn()}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-muted-foreground">
                                {columns.length} columns active
                            </span>
                            <Button size="sm" onClick={handleAddColumn} disabled={!newColumnName.trim()} className="h-7 text-xs">
                                Add
                            </Button>
                        </div>

                        {/* Quick-add suggestions */}
                        <div className="pt-2 border-t">
                            <p className="text-[11px] text-muted-foreground mb-2">Quick Add</p>
                            <div className="flex flex-wrap gap-1">
                                {["Governing Law", "Confidentiality", "Indemnification", "Liability Cap", "Termination", "Non-Compete"].map(name => (
                                    <button
                                        key={name}
                                        className="px-2 py-0.5 text-[11px] rounded-full border hover:bg-muted transition-colors"
                                        onClick={() => {
                                            onAddColumn(name)
                                            setAddColumnOpen(false)
                                        }}
                                    >
                                        + {name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Templates */}
            <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                        <LayoutTemplate className="h-3.5 w-3.5" />
                        Templates
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="px-3 py-2 border-b">
                        <h4 className="text-sm font-semibold">Column Templates</h4>
                        <p className="text-[11px] text-muted-foreground">Replace columns with a preset</p>
                    </div>
                    <div className="py-1">
                        {Object.entries(templates).map(([id, template]) => (
                            <button
                                key={id}
                                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                    onApplyTemplate(id)
                                    setTemplateOpen(false)
                                }}
                            >
                                <p className="text-sm font-medium">{template.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {template.columns.length} columns · {template.columns.map(c => c.name).join(", ")}
                                </p>
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>

            <div className="flex-1" />

            {/* AI generating columns indicator */}
            {isGeneratingColumns && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Analyzing documents...
                </span>
            )}

            {/* Document count */}
            {!isGeneratingColumns && (
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    <Columns3 className="h-3 w-3 inline mr-1" />
                    {columns.length} cols · {documentCount} docs
                </span>
            )}

            <div className="w-px h-5 bg-border mx-1" />

            {/* Run All */}
            <Button
                size="sm"
                onClick={onRunAll}
                disabled={isRunning || isGeneratingColumns || documentCount === 0}
                className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
                {isRunning ? (
                    <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {progressPct}%
                    </>
                ) : isGeneratingColumns ? (
                    <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Wait
                    </>
                ) : (
                    <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Run all
                    </>
                )}
            </Button>
        </div>
    )
}
