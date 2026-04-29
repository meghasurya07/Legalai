"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    Bold, Italic, Underline, Strikethrough, Highlighter,
    Heading1, Heading2, Sparkles, RefreshCw, Minimize2,
    Type, Zap, BookMarked,
} from 'lucide-react'

interface FloatingToolbarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any
    onAICommand: (position: { top: number; left: number }) => void
    onInlineAICommand?: (command: string, commandLabel: string, selectedText: string) => void
}

export function FloatingToolbar({ editor, onAICommand, onInlineAICommand }: FloatingToolbarProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const [showAIMenu, setShowAIMenu] = useState(false)
    const toolbarRef = useRef<HTMLDivElement>(null)
    const submenuRef = useRef<HTMLDivElement>(null)

    const updatePosition = useCallback(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
            setIsVisible(false)
            setShowAIMenu(false)
            return
        }

        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        // Position above the selection
        const top = rect.top - 48
        const left = rect.left + (rect.width / 2) - 120 // Center it

        setPosition({
            top: Math.max(8, top),
            left: Math.max(8, left),
        })
        setIsVisible(true)
    }, [])

    useEffect(() => {
        document.addEventListener('selectionchange', updatePosition)
        document.addEventListener('mouseup', updatePosition)
        return () => {
            document.removeEventListener('selectionchange', updatePosition)
            document.removeEventListener('mouseup', updatePosition)
        }
    }, [updatePosition])

    useEffect(() => {
        if (toolbarRef.current && position) {
            toolbarRef.current.style.top = `${position.top}px`
            toolbarRef.current.style.left = `${position.left}px`
        }
        if (submenuRef.current && position) {
            submenuRef.current.style.top = `${position.top + 44}px`
            submenuRef.current.style.left = `${position.left}px`
        }
    }, [position])

    const isMarkActive = (mark: string): boolean => {
        try {
            const marks = editor?.getMarks()
            return marks ? !!marks[mark] : false
        } catch {
            return false
        }
    }

    const toggleMark = (mark: string) => {
        if (!editor) return
        const active = isMarkActive(mark)
        if (active) {
            editor.removeMark(mark)
        } else {
            editor.addMark(mark, true)
        }
    }

    const toggleBlock = (type: string) => {
        if (!editor) return
        editor.tf.setNodes({ type })
    }

    const handleInlineAI = (command: string, commandLabel: string) => {
        const sel = window.getSelection()
        const selectedText = sel?.toString() || ''
        if (!selectedText.trim()) return

        setShowAIMenu(false)
        setIsVisible(false)

        if (onInlineAICommand) {
            onInlineAICommand(command, commandLabel, selectedText)
        }
    }

    if (!isVisible) return null

    return (
        <>
            <div
                ref={toolbarRef}
                className="fixed z-40 bg-popover/95 backdrop-blur-sm border border-border/60 rounded-xl shadow-xl px-1.5 py-1 flex items-center gap-0.5 animate-in fade-in-0 zoom-in-95"
                onMouseDown={(e) => e.preventDefault()}
            >
                <ToolbarBtn onClick={() => toggleMark('bold')} active={isMarkActive('bold')} icon={<Bold className="h-3.5 w-3.5" />} />
                <ToolbarBtn onClick={() => toggleMark('italic')} active={isMarkActive('italic')} icon={<Italic className="h-3.5 w-3.5" />} />
                <ToolbarBtn onClick={() => toggleMark('underline')} active={isMarkActive('underline')} icon={<Underline className="h-3.5 w-3.5" />} />
                <ToolbarBtn onClick={() => toggleMark('strikethrough')} active={isMarkActive('strikethrough')} icon={<Strikethrough className="h-3.5 w-3.5" />} />
                <ToolbarBtn onClick={() => toggleMark('highlight')} active={isMarkActive('highlight')} icon={<Highlighter className="h-3.5 w-3.5" />} />

                <div className="w-px h-5 bg-border/60 mx-0.5" />

                <ToolbarBtn onClick={() => toggleBlock('h1')} icon={<Heading1 className="h-3.5 w-3.5" />} />
                <ToolbarBtn onClick={() => toggleBlock('h2')} icon={<Heading2 className="h-3.5 w-3.5" />} />

                <div className="w-px h-5 bg-border/60 mx-0.5" />

                {/* AI Inline Suggestion Button */}
                <ToolbarBtn
                    onClick={() => setShowAIMenu(!showAIMenu)}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    className="text-violet-500 hover:text-violet-600 hover:bg-violet-500/10"
                    active={showAIMenu}
                />
            </div>

            {/* AI Command Submenu */}
            {showAIMenu && (
                <div
                    ref={submenuRef}
                    className="fixed z-50 bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl py-1 w-52 animate-in fade-in-0 slide-in-from-top-2"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <div className="px-3 py-1.5 border-b border-border/40">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI Suggestions</p>
                    </div>
                    <AIMenuItem
                        icon={<RefreshCw className="h-3.5 w-3.5" />}
                        label="Rewrite"
                        description="Improve clarity & flow"
                        onClick={() => handleInlineAI('rewrite', 'Rewritten by AI')}
                    />
                    <AIMenuItem
                        icon={<Minimize2 className="h-3.5 w-3.5" />}
                        label="Simplify"
                        description="Plain language"
                        onClick={() => handleInlineAI('simplify', 'Simplified by AI')}
                    />
                    <AIMenuItem
                        icon={<Type className="h-3.5 w-3.5" />}
                        label="Formalize"
                        description="Professional tone"
                        onClick={() => handleInlineAI('tone', 'Formalized by AI')}
                    />
                    <AIMenuItem
                        icon={<Zap className="h-3.5 w-3.5" />}
                        label="Make Concise"
                        description="Shorter & tighter"
                        onClick={() => handleInlineAI('summarize', 'Made concise by AI')}
                    />
                    <div className="border-t border-border/40 mt-1 pt-1">
                        <AIMenuItem
                            icon={<BookMarked className="h-3.5 w-3.5 text-violet-500" />}
                            label="From Library..."
                            description="Use a saved prompt"
                            onClick={() => {
                                setShowAIMenu(false)
                                window.open('/prompt-library', '_blank')
                            }}
                        />
                        <AIMenuItem
                            icon={<Sparkles className="h-3.5 w-3.5 text-violet-500" />}
                            label="More AI..."
                            description="All AI commands"
                            onClick={() => {
                                setShowAIMenu(false)
                                onAICommand(position)
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

function ToolbarBtn({ onClick, active, icon, className }: {
    onClick: () => void
    active?: boolean
    icon: React.ReactNode
    className?: string
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md ${
                active
                    ? 'bg-primary/10 text-primary'
                    : className || 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={onClick}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
        >
            {icon}
        </Button>
    )
}

function AIMenuItem({ icon, label, description, onClick }: {
    icon: React.ReactNode
    label: string
    description: string
    onClick: () => void
}) {
    return (
        <button
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors text-left"
            onClick={onClick}
            type="button"
        >
            <span className="text-muted-foreground">{icon}</span>
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground">{description}</p>
            </div>
        </button>
    )
}
