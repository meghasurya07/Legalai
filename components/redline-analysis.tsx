"use client"

import * as React from "react"
import { Upload, FileText, ArrowLeft, Loader2, CheckCircle2, XCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"

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
    const router = useRouter()
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
            const response = await fetch('/api/workflows/redline-analysis', {
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
            const response = await fetch('/api/workflows/redline-analysis/query', {
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
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 pb-32">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/workflows')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">Redline Analysis</h1>
                            <p className="text-muted-foreground">Compare document versions and analyze changes with AI</p>
                        </div>
                    </div>

                    {!result ? (
                        /* Upload Section */
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Original Document */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Original Document</CardTitle>
                                    <CardDescription>Upload the original version</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                                        <input
                                            type="file"
                                            id="original-file"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && handleFileSelect('original', e.target.files[0])}
                                        />
                                        <label htmlFor="original-file" className="cursor-pointer">
                                            {originalFile ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                    <p className="font-medium">{originalFile.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {(originalFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Upload className="h-12 w-12 text-muted-foreground" />
                                                    <p className="font-medium">Click to upload</p>
                                                    <p className="text-sm text-muted-foreground">Any file type supported</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Revised Document */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Revised Document</CardTitle>
                                    <CardDescription>Upload the revised version</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                                        <input
                                            type="file"
                                            id="revised-file"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && handleFileSelect('revised', e.target.files[0])}
                                        />
                                        <label htmlFor="revised-file" className="cursor-pointer">
                                            {revisedFile ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                    <p className="font-medium">{revisedFile.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {(revisedFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Upload className="h-12 w-12 text-muted-foreground" />
                                                    <p className="font-medium">Click to upload</p>
                                                    <p className="text-sm text-muted-foreground">Any file type supported</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        /* Results Section */
                        <div className="space-y-6">
                            {/* Statistics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">{result.statistics.totalChanges}</div>
                                        <p className="text-xs text-muted-foreground">Total Changes</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold text-green-600">{result.statistics.addedLines}</div>
                                        <p className="text-xs text-muted-foreground">Additions</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold text-red-600">{result.statistics.deletedLines}</div>
                                        <p className="text-xs text-muted-foreground">Deletions</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold text-blue-600">{result.statistics.modifiedLines}</div>
                                        <p className="text-xs text-muted-foreground">Modifications</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Summary */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm leading-relaxed">{result.summary}</p>
                                </CardContent>
                            </Card>

                            {/* Changes Details */}
                            <div className="grid md:grid-cols-3 gap-4">
                                {result.changes.additions.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base text-green-600">Additions</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-2 text-sm">
                                                {result.changes.additions.map((change, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <span className="text-green-600 mt-0.5">+</span>
                                                        <span className="flex-1">{change}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardContent>
                                    </Card>
                                )}

                                {result.changes.deletions.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base text-red-600">Deletions</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-2 text-sm">
                                                {result.changes.deletions.map((change, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <span className="text-red-600 mt-0.5">-</span>
                                                        <span className="flex-1">{change}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardContent>
                                    </Card>
                                )}

                                {result.changes.modifications.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base text-blue-600">Modifications</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-2 text-sm">
                                                {result.changes.modifications.map((change, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <span className="text-blue-600 mt-0.5">~</span>
                                                        <span className="flex-1">{change}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Q&A Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ask Questions</CardTitle>
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
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 mt-8">
                        {!result ? (
                            <Button
                                onClick={handleCompare}
                                disabled={!originalFile || !revisedFile || isProcessing}
                                size="lg"
                                className="gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="h-4 w-4" />
                                        Compare Documents
                                    </>
                                )}
                            </Button>
                        ) : (
                            <>
                                <Button onClick={resetAnalysis} variant="outline" className="gap-2">
                                    <XCircle className="h-4 w-4" />
                                    New Analysis
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </div>
    )
}
