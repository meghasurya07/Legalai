"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, Sparkles, Loader2, Send, Copy, Plus, BookMarked } from 'lucide-react'
import { toast } from 'sonner'
import { PromptLibraryPicker } from './prompt-library-picker'

interface AIChatPanelProps {
    isOpen: boolean
    onClose: () => void
    onInsert: (text: string) => void
    documentContext: string
    documentType: string
}

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export function AIChatPanel({ isOpen, onClose, onInsert, documentContext, documentType }: AIChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: ChatMessage = { role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            const response = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'draft',
                    prompt: userMessage.content,
                    documentType,
                    context: documentContext.substring(0, 3000),
                }),
            })

            if (!response.ok) throw new Error('AI request failed')

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            let assistantText = ''
            setMessages(prev => [...prev, { role: 'assistant', content: '' }])

            const decoder = new TextDecoder()
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                // Parse SSE data chunks
                const lines = chunk.split('\n')
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(line.slice(6))
                            if (parsed.text) {
                                assistantText += parsed.text
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = { role: 'assistant', content: assistantText }
                                    return updated
                                })
                            }
                        } catch { /* skip non-text chunks */ }
                    }
                }
            }
        } catch {
            toast.error('AI generation failed')
            setMessages(prev => prev.filter(m => m.content !== ''))
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="w-96 border-l bg-background flex flex-col h-full shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold">AI Assistant</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center py-8">
                        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">Ask AI to help draft content</p>
                        <div className="mt-4 space-y-2">
                            {[
                                'Draft a force majeure clause',
                                'Write an executive summary',
                                'Create a confidentiality section',
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    className="block w-full text-left text-xs text-muted-foreground/70 hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    &ldquo;{suggestion}&rdquo;
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/60 border border-border/40'
                        }`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            {msg.role === 'assistant' && msg.content && (
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] gap-1 text-muted-foreground"
                                        onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied') }}
                                    >
                                        <Copy className="h-3 w-3" />
                                        Copy
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] gap-1 text-primary"
                                        onClick={() => { onInsert(msg.content); toast.success('Inserted into document') }}
                                    >
                                        <Plus className="h-3 w-3" />
                                        Insert
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] gap-1 text-violet-600 dark:text-violet-400"
                                        onClick={() => {
                                            window.open(`/prompt-library?saveContent=${encodeURIComponent(msg.content)}`, '_blank')
                                        }}
                                    >
                                        <BookMarked className="h-3 w-3" />
                                        Save as Prompt
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && messages[messages.length - 1]?.content === '' && (
                    <div className="flex justify-start">
                        <div className="bg-muted/60 rounded-xl px-4 py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="border-t p-3 relative">
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-violet-600 dark:text-violet-400"
                        onClick={() => setShowPicker(prev => !prev)}
                        title="From Library"
                    >
                        <BookMarked className="h-4 w-4" />
                    </Button>
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask AI to draft, rewrite, or edit..."
                        className="min-h-[40px] max-h-[120px] resize-none text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                {showPicker && (
                    <PromptLibraryPicker
                        onSelect={(p) => { setInput(p.content); setShowPicker(false) }}
                        onClose={() => setShowPicker(false)}
                    />
                )}
            </div>
        </div>
    )
}
