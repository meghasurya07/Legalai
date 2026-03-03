"use client"

import * as React from "react"
import { FileText, Loader2, XCircle, Send, Plus, Minus, RefreshCw, FileEdit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"
import { FileUploadZone } from "@/components/ui/file-upload-zone"

interface ComparisonResult {
    summary: string
    changes: {
        additions: string[]
        deletions: string[]
        modifications: string[]
    }
    statistics: {
        totalChanges: number
        addedLines: number
        deletedLines: number
        modifiedLines: number
    }
}

export default function RedlineAnalysis() {
    const [originalFile, setOriginalFile] = React.useState<File | null>(null)
    const [revisedFile, setRevisedFile] = React.useState<File | null>(null)
    const [isProcessing, setIsProcessing] = React.useState(false)
    const [result, setResult] = React.useState<ComparisonResult | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)
    const [question, setQuestion] = React.useState("")
    const [conversation, setConversation] = React.useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
    const [isAsking, setIsAsking] = React.useState(false)

    const handleFileSelect = (type: 'original' | 'revised', file: File) => {
        if ((type === 'original' && revisedFile && revisedFile.name === file.name) ||
            (type === 'revised' && originalFile && originalFile.name === file.name) ||
            (type === 'original' && originalFile && originalFile.name === file.name) ||
            (type === 'revised' && revisedFile && revisedFile.name === file.name)) {
            setIsDuplicateModalOpen(true)
            return
        }
        if (type === 'original') {
            setOriginalFile(file)
        } else {
            setRevisedFile(file)
        }
        toast.success(`${type === 'original' ? 'Original' : 'Revised'} file uploaded`)
    }

    const handleCompare = async () => {
        if (!originalFile || !revisedFile) {
            toast.error("Please upload both original and revised files")
            return
        }

        setIsProcessing(true)
        const formData = new FormData()
        formData.append('original', originalFile)
        formData.append('revised', revisedFile)

        try {
            const response = await fetch('/api/templates/redline-analysis', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to process documents')
            }

            const data = await response.json()
            setResult(data)
            toast.success("Documents compared successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to compare documents"
            toast.error(message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleAskQuestion = async () => {
        if (!question.trim() || !result) return

        setIsAsking(true)
        const userMessage = question
        setConversation(prev => [...prev, { role: 'user', content: userMessage }])
        setQuestion("")

        try {
            const response = await fetch('/api/templates/redline-analysis/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: userMessage,
                    context: result
                })
            })

            if (!response.ok) {
                throw new Error('Failed to get answer')
            }

            const data = await response.json()
            setConversation(prev => [...prev, { role: 'assistant', content: data.answer }])
        } catch (error) {
            console.error(error)
            toast.error("Failed to get answer")
        } finally {
            setIsAsking(false)
        }
    }

    const resetAnalysis = () => {
        setOriginalFile(null)
        setRevisedFile(null)
        setResult(null)
        setConversation([])
        setQuestion("")
    }

    return (
        <ToolPageLayout
            title="Redline Analysis"
            description="Compare document versions and analyze changes with AI"
            icon={<FileEdit className="h-4 w-4" />}
            accentColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >

            {!result ? (
                /* Upload Section */
                <div className="space-y-5 max-w-4xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card className="border-dashed">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">Original</Badge>
                                    <CardTitle className="text-base">Original Document</CardTitle>
                                </div>
                                <CardDescription>Upload the original version</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FileUploadZone id="original-file" file={originalFile} onFileSelect={(f) => handleFileSelect('original', f)} />
                            </CardContent>
                        </Card>

                        <Card className="border-dashed">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">Revised</Badge>
                                    <CardTitle className="text-base">Revised Document</CardTitle>
                                </div>
                                <CardDescription>Upload the revised version</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FileUploadZone id="revised-file" file={revisedFile} onFileSelect={(f) => handleFileSelect('revised', f)} />
                            </CardContent>
                        </Card>
                    </div>

                    <Button
                        onClick={handleCompare}
                        disabled={!originalFile || !revisedFile || isProcessing}
                        size="lg"
                        className="w-full gap-2"
                    >
                        {isProcessing ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                            <><FileEdit className="h-4 w-4" /> Compare Documents</>
                        )}
                    </Button>
                </div>
            ) : (
                /* Results Section */
                <div className="space-y-5">
                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-muted/30">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono">{result.statistics.totalChanges}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Total Changes</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-500/5 border-emerald-500/20">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{result.statistics.addedLines}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Additions</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-500/5 border-red-500/20">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{result.statistics.deletedLines}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Deletions</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-blue-500/5 border-blue-500/20">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">{result.statistics.modifiedLines}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Modifications</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Changes Details */}
                    <div className="grid md:grid-cols-3 gap-4">
                        {result.changes.additions.length > 0 && (
                            <Card className="border-emerald-500/20">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-emerald-700 dark:text-emerald-300">Additions</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.changes.additions.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm">
                                        {result.changes.additions.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2 border-l-2 border-emerald-500/40 pl-3 py-0.5">
                                                <span className="text-foreground/90">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}

                        {result.changes.deletions.length > 0 && (
                            <Card className="border-red-500/20">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        <span className="text-red-700 dark:text-red-300">Deletions</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.changes.deletions.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm">
                                        {result.changes.deletions.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2 border-l-2 border-red-500/40 pl-3 py-0.5 line-through text-muted-foreground">
                                                <span>{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}

                        {result.changes.modifications.length > 0 && (
                            <Card className="border-blue-500/20">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-blue-700 dark:text-blue-300">Modifications</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.changes.modifications.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm">
                                        {result.changes.modifications.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2 border-l-2 border-blue-500/40 pl-3 py-0.5">
                                                <span className="text-foreground/90">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Q&A Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Ask Questions</CardTitle>
                            <CardDescription>Ask questions about the changes in the document</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {conversation.length > 0 && (
                                <div className="space-y-3 max-h-64 overflow-auto mb-4">
                                    {conversation.map((msg, i) => (
                                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`rounded-lg px-4 py-2 max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                <p className="text-sm">{msg.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Ask about the changes..."
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleAskQuestion()
                                        }
                                    }}
                                    className="min-h-[60px]"
                                />
                                <Button onClick={handleAskQuestion} disabled={isAsking || !question.trim()}>
                                    {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Button onClick={resetAnalysis} variant="outline" className="gap-2">
                        <XCircle className="h-4 w-4" />
                        New Analysis
                    </Button>
                </div>
            )}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </ToolPageLayout>
    )
}
