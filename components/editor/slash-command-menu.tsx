"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Sparkles, Wand2, RefreshCw, ArrowDown, ArrowUp,
    FileText, Scale, Quote, BookOpen, Languages, BookMarked,
} from 'lucide-react'

interface SlashCommandMenuProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (command: string, label: string) => void
    position: { top: number; left: number }
}

const COMMANDS = [
    { id: 'draft', label: 'Draft', description: 'Generate a new section from a prompt', icon: FileText },
    { id: 'rewrite', label: 'Rewrite', description: 'Rewrite selected text for clarity', icon: RefreshCw },
    { id: 'tone', label: 'Adjust Tone', description: 'Change tone (formal, persuasive, concise)', icon: Wand2 },
    { id: 'expand', label: 'Expand', description: 'Expand into more detail', icon: ArrowUp },
    { id: 'simplify', label: 'Simplify', description: 'Simplify complex language', icon: ArrowDown },
    { id: 'summarize', label: 'Summarize', description: 'Summarize selected content', icon: BookOpen },
    { id: 'clause', label: 'Insert Clause', description: 'Generate a standard legal clause', icon: Scale },
    { id: 'citations', label: 'Add Citations', description: 'Add supporting legal citations', icon: Quote },
    { id: 'translate', label: 'Translate', description: 'Translate selected text', icon: Languages },
    { id: 'from-library', label: 'From Library', description: 'Use a saved prompt from your library', icon: BookMarked },
]

export function SlashCommandMenu({ isOpen, onClose, onSelect, position }: SlashCommandMenuProps) {
    if (!isOpen) return null
    return <SlashCommandMenuInner onClose={onClose} onSelect={onSelect} position={position} />
}

function SlashCommandMenuInner({ onClose, onSelect, position }: Omit<SlashCommandMenuProps, 'isOpen'>) {
    const [query] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const menuRef = useRef<HTMLDivElement>(null)

    const filtered = COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase())
    )

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose()
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(i => Math.max(i - 1, 0))
        }
        if (e.key === 'Enter' && filtered[selectedIndex]) {
            e.preventDefault()
            onSelect(filtered[selectedIndex].id, filtered[selectedIndex].label)
        }
    }, [filtered, selectedIndex, onClose, onSelect])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose])

    // Position the menu via ref to avoid inline styles
    useEffect(() => {
        if (menuRef.current) {
            menuRef.current.style.top = `${position.top}px`
            menuRef.current.style.left = `${position.left}px`
        }
    }, [position])

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-72 bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
        >
            {/* Header */}
            <div className="px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-muted-foreground">AI Commands</span>
                </div>
            </div>

            {/* Commands */}
            <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">No matching commands</div>
                ) : (
                    filtered.map((cmd, index) => {
                        const Icon = cmd.icon
                        return (
                            <button
                                key={cmd.id}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-primary/8 text-foreground'
                                        : 'hover:bg-muted/50 text-foreground/80'
                                }`}
                                onClick={() => onSelect(cmd.id, cmd.label)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                                    index === selectedIndex
                                        ? 'bg-violet-500/15 text-violet-600'
                                        : 'bg-muted/60 text-muted-foreground'
                                }`}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">{cmd.label}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{cmd.description}</p>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
