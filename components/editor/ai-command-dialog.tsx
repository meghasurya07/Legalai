"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, Sparkles, Loader2, Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface AICommandDialogProps {
    isOpen: boolean
    command: string
    commandLabel: string
    selectedText: string
    onClose: () => void
    onInsert: (text: string) => void
    documentType: string
    documentContext: string
}

export function AICommandDialog({
    isOpen,
    command,
    commandLabel,
    selectedText,
    onClose,
    onInsert,
    documentType,
    documentContext,
}: AICommandDialogProps) {
    const [prompt, setPrompt] = useState('')
    const [result, setResult] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus()
        }
        if (!isOpen) {
            setPrompt('')
            setResult('')
        }
    }, [isOpen])

    const handleGenerate = async () => {
        setIsLoading(true)
        setResult('')

        try {
            const response = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command,
                    prompt,
                    selection: selectedText,
                    documentType,
                    context: documentContext.substring(0, 3000),
                }),
            })

            if (!response.ok) throw new Error('Failed')

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No body')

            let fullText = ''
            const decoder = new TextDecoder()
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n')
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(line.slice(6))
                            if (parsed.text) {
                                fullText += parsed.text
                                setResult(fullText)
                            }
                        } catch { /* skip */ }
                    }
                }
            }
        } catch {
            toast.error('AI generation failed')
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-background border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold">AI: {commandLabel}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {selectedText && (
                        <div className="bg-muted/40 border rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Selected Text</p>
                            <p className="text-sm text-foreground/80 line-clamp-3">{selectedText}</p>
                        </div>
                    )}

                    <Textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={
                            command === 'draft' ? 'Describe what to draft...' :
                            command === 'tone' ? 'Specify tone: formal, persuasive, neutral, concise...' :
                            command === 'clause' ? 'Specify clause type: force majeure, indemnity, NDA...' :
                            'Additional instructions (optional)...'
                        }
                        className="min-h-[80px] resize-none text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault()
                                handleGenerate()
                            }
                        }}
                    />

                    {result && (
                        <div className="bg-muted/20 border rounded-lg p-4 max-h-60 overflow-y-auto">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Result</p>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{result}</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/20">
                    {result ? (
                        <>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerate} disabled={isLoading}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                Regenerate
                            </Button>
                            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white" onClick={() => { onInsert(result); onClose() }}>
                                <Check className="h-3.5 w-3.5" />
                                Insert
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" className="gap-1.5" onClick={handleGenerate} disabled={isLoading || (!prompt && !selectedText)}>
                            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            Generate
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
