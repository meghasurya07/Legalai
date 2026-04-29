"use client"

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
    List, ListOrdered, Quote, Minus, Highlighter,
} from 'lucide-react'

interface EditorToolbarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any
    readOnly?: boolean
}

interface ToolbarButtonProps {
    onClick: () => void
    isActive?: boolean
    icon: React.ReactNode
    label: string
    disabled?: boolean
}

function ToolbarButton({ onClick, isActive, icon, label, disabled }: ToolbarButtonProps) {
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-md transition-colors ${
                            isActive
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                        onClick={(e) => { e.preventDefault(); onClick() }}
                        disabled={disabled}
                        type="button"
                    >
                        {icon}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// Helper to check if a mark is active
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMarkActive(editor: any, mark: string): boolean {
    try {
        const marks = editor.getMarks()
        return marks ? !!marks[mark] : false
    } catch {
        return false
    }
}

// Helper to check if a block type is active
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBlockActive(editor: any, type: string): boolean {
    try {
        const [match] = editor.nodes({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            match: (n: any) => !editor.isEditor(n) && n.type === type,
        })
        return !!match
    } catch {
        return false
    }
}

export function EditorToolbar({ editor, readOnly }: EditorToolbarProps) {
    if (readOnly) return null

    const toggleMark = (mark: string) => {
        if (!editor) return
        const active = isMarkActive(editor, mark)
        if (active) {
            editor.removeMark(mark)
        } else {
            editor.addMark(mark, true)
        }
        try { editor.focus() } catch { /* noop */ }
    }

    const toggleBlock = (type: string) => {
        if (!editor) return
        const active = isBlockActive(editor, type)
        editor.tf.setNodes({ type: active ? 'p' : type })
        try { editor.focus() } catch { /* noop */ }
    }

    const insertHR = () => {
        if (!editor) return
        editor.tf.insertNodes({ type: 'hr', children: [{ text: '' }] })
        try { editor.focus() } catch { /* noop */ }
    }

    return (
        <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
                {/* Marks */}
                <ToolbarButton
                    onClick={() => toggleMark('bold')}
                    isActive={isMarkActive(editor, 'bold')}
                    icon={<Bold className="h-4 w-4" />}
                    label="Bold (Ctrl+B)"
                />
                <ToolbarButton
                    onClick={() => toggleMark('italic')}
                    isActive={isMarkActive(editor, 'italic')}
                    icon={<Italic className="h-4 w-4" />}
                    label="Italic (Ctrl+I)"
                />
                <ToolbarButton
                    onClick={() => toggleMark('underline')}
                    isActive={isMarkActive(editor, 'underline')}
                    icon={<Underline className="h-4 w-4" />}
                    label="Underline (Ctrl+U)"
                />
                <ToolbarButton
                    onClick={() => toggleMark('strikethrough')}
                    isActive={isMarkActive(editor, 'strikethrough')}
                    icon={<Strikethrough className="h-4 w-4" />}
                    label="Strikethrough"
                />
                <ToolbarButton
                    onClick={() => toggleMark('highlight')}
                    isActive={isMarkActive(editor, 'highlight')}
                    icon={<Highlighter className="h-4 w-4" />}
                    label="Highlight"
                />

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Block types */}
                <ToolbarButton
                    onClick={() => toggleBlock('h1')}
                    isActive={isBlockActive(editor, 'h1')}
                    icon={<Heading1 className="h-4 w-4" />}
                    label="Heading 1"
                />
                <ToolbarButton
                    onClick={() => toggleBlock('h2')}
                    isActive={isBlockActive(editor, 'h2')}
                    icon={<Heading2 className="h-4 w-4" />}
                    label="Heading 2"
                />
                <ToolbarButton
                    onClick={() => toggleBlock('h3')}
                    isActive={isBlockActive(editor, 'h3')}
                    icon={<Heading3 className="h-4 w-4" />}
                    label="Heading 3"
                />

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Lists */}
                <ToolbarButton
                    onClick={() => toggleBlock('ul')}
                    isActive={isBlockActive(editor, 'ul')}
                    icon={<List className="h-4 w-4" />}
                    label="Bullet List"
                />
                <ToolbarButton
                    onClick={() => toggleBlock('ol')}
                    isActive={isBlockActive(editor, 'ol')}
                    icon={<ListOrdered className="h-4 w-4" />}
                    label="Numbered List"
                />

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Others */}
                <ToolbarButton
                    onClick={() => toggleBlock('blockquote')}
                    isActive={isBlockActive(editor, 'blockquote')}
                    icon={<Quote className="h-4 w-4" />}
                    label="Blockquote"
                />
                <ToolbarButton
                    onClick={insertHR}
                    icon={<Minus className="h-4 w-4" />}
                    label="Horizontal Rule"
                />
            </div>
        </div>
    )
}
