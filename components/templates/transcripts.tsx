"use client"

import * as React from "react"
import { Loader2, FileText, CheckCircle2, MessageSquare, Send, Users, AlertTriangle, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"

interface TranscriptAnalysis {
    summary: string
    keyThemes: Array<{
        theme: string
        description: string
        importance: 'high' | 'medium' | 'low'
    }>
    witnesses: Array<{
        name: string
        role: string
        keyTestimony: string[]
        credibilityNotes: string
    }>
    contradictions: string[]
    importantAdmissions: string[]
    timeline: Array<{
        date: string
        event: string
    }>
}

export default function Transcripts() {
    const {
        file: transcriptFile,
        handleFileSelect,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isRunning: isAnalyzing,
        result: analysis,
        runWithFile,
        reset,
    } = useTemplateWorkflow<TranscriptAnalysis>({
        apiEndpoint: '/api/templates/transcripts',
    })

    const [question, setQuestion] = React.useState("")
    const [conversation, setConversation] = React.useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
    const [isAsking, setIsAsking] = React.useState(false)

    const handleAnalyze = async () => {
        if (!transcriptFile) {
            toast.error("Please upload a transcript file")
            return
        }
        const formData = new FormData()
        formData.append('transcript', transcriptFile)
        await runWithFile(formData, "Transcript analyzed successfully!")
    }

    const handleAskQuestion = async () => {
        if (!question.trim() || !analysis) return
        setIsAsking(true)
        const userMessage = question
        setConversation(prev => [...prev, { role: 'user', content: userMessage }])
        setQuestion("")
        try {
            const response = await fetch('/api/templates/transcripts/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userMessage, context: analysis })
            })
            if (!response.ok) throw new Error('Failed to get answer')
            const data = await response.json()
            setConversation(prev => [...prev, { role: 'assistant', content: data.answer }])
        } catch {
            toast.error("Failed to get answer")
        } finally {
            setIsAsking(false)
        }
    }

    const resetAnalysis = () => {
        setConversation([])
        setQuestion("")
        reset()
    }

    const importanceBorderColor = (importance: string) => {
        switch (importance) {
            case 'high': return 'border-red-500/40'
            case 'medium': return 'border-amber-500/40'
            default: return 'border-blue-500/30'
        }
    }

    const importanceBadgeVariant = (importance: string): 'destructive' | 'default' | 'secondary' => {
        switch (importance) {
            case 'high': return 'destructive'
            case 'medium': return 'default'
            default: return 'secondary'
        }
    }

    return (
        <ToolPageLayout
            title="Transcripts"
            description="Analyze deposition and trial transcripts for key insights"
            icon={<BookOpen className="h-4 w-4" />}
            accentColor="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        >

            {!analysis ? (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Upload Transcript</CardTitle>
                        <CardDescription>Upload a deposition, trial, or hearing transcript</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FileUploadZone id="transcript" file={transcriptFile} onFileSelect={handleFileSelect} />
                        <Button onClick={handleAnalyze} disabled={!transcriptFile || isAnalyzing} size="lg" className="w-full gap-2">
                            {isAnalyzing ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing Transcript...</>
                            ) : (
                                <><BookOpen className="h-4 w-4" /> Analyze Transcript</>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-5">
                    {/* Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                                    <BookOpen className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                                </div>
                                Executive Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Key Themes */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                Key Themes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {analysis.keyThemes.map((theme, i) => (
                                    <div key={i} className={`border-l-2 ${importanceBorderColor(theme.importance)} pl-4 py-1`}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-semibold text-sm">{theme.theme}</h3>
                                            <Badge variant={importanceBadgeVariant(theme.importance)} className="text-[10px]">{theme.importance}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{theme.description}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Witnesses */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                                    <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                </div>
                                Witness Analysis
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {analysis.witnesses.map((witness, i) => (
                                    <div key={i} className="border rounded-lg p-4 bg-muted/10">
                                        <div className="mb-2">
                                            <h3 className="font-semibold text-sm">{witness.name}</h3>
                                            <p className="text-xs text-muted-foreground">{witness.role}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-[10px] font-bold tracking-wide uppercase text-muted-foreground mb-1">Key Testimony</p>
                                                <ul className="space-y-1">
                                                    {witness.keyTestimony.map((testimony, j) => (
                                                        <li key={j} className="text-sm flex items-start gap-2 border-l-2 border-primary/20 pl-2.5 py-0.5 text-foreground/90">{testimony}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold tracking-wide uppercase text-muted-foreground mb-1">Credibility Assessment</p>
                                                <p className="text-sm text-foreground/80 italic">{witness.credibilityNotes}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contradictions */}
                    {analysis.contradictions.length > 0 && (
                        <Card className="border-amber-500/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    Contradictions & Inconsistencies
                                    <Badge variant="destructive" className="ml-auto text-[10px]">{analysis.contradictions.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {analysis.contradictions.map((contradiction, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm rounded-md bg-amber-500/5 p-3">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span className="text-foreground/90">{contradiction}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Important Admissions */}
                    {analysis.importantAdmissions.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    Important Admissions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {analysis.importantAdmissions.map((admission, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-sm">
                                            <span className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                            </span>
                                            <span className="text-foreground/90">{admission}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Q&A */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <MessageSquare className="h-4 w-4" />
                                Ask Questions
                            </CardTitle>
                            <CardDescription>Query the transcript for specific information</CardDescription>
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
                                    placeholder="Ask about the transcript..."
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskQuestion() } }}
                                    className="min-h-[60px]"
                                />
                                <Button onClick={handleAskQuestion} disabled={isAsking || !question.trim()}>
                                    {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Button onClick={resetAnalysis} variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Analyze New Transcript
                    </Button>
                </div>
            )}
            <DuplicateFileModal isOpen={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen} />
        </ToolPageLayout>
    )
}

