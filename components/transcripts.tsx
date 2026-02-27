"use client"

import * as React from "react"
import { Upload, ArrowLeft, Loader2, FileText, CheckCircle2, MessageSquare, Send, Users, AlertTriangle, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"

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
    const router = useRouter()
    const [transcriptFile, setTranscriptFile] = React.useState<File | null>(null)
    const [isAnalyzing, setIsAnalyzing] = React.useState(false)
    const [analysis, setAnalysis] = React.useState<TranscriptAnalysis | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)
    const [question, setQuestion] = React.useState("")
    const [conversation, setConversation] = React.useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
    const [isAsking, setIsAsking] = React.useState(false)

    const handleFileSelect = (file: File) => {
        if (transcriptFile && transcriptFile.name === file.name) {
            setIsDuplicateModalOpen(true)
            return
        }
        setTranscriptFile(file)
        toast.success("Transcript uploaded")
    }

    const handleAnalyze = async () => {
        if (!transcriptFile) {
            toast.error("Please upload a transcript file")
            return
        }

        setIsAnalyzing(true)
        const formData = new FormData()
        formData.append('transcript', transcriptFile)

        try {
            const response = await fetch('/api/templates/transcripts', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to analyze transcript')
            }

            const data = await response.json()
            setAnalysis(data)
            toast.success("Transcript analyzed successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to analyze transcript"
            toast.error(message)
        } finally {
            setIsAnalyzing(false)
        }
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
                body: JSON.stringify({
                    question: userMessage,
                    context: analysis
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
        setTranscriptFile(null)
        setAnalysis(null)
        setConversation([])
        setQuestion("")
    }


    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 pb-32">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/templates')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">Transcripts</h1>
                            <p className="text-muted-foreground">Analyze deposition and trial transcripts for key insights</p>
                        </div>
                    </div>

                    {!analysis ? (
                        /* Upload Section */
                        <Card className="max-w-2xl mx-auto">
                            <CardHeader>
                                <CardTitle>Upload Transcript</CardTitle>
                                <CardDescription>Upload a deposition, trial, or hearing transcript</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                                    <input
                                        type="file"
                                        id="transcript"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                    />
                                    <label htmlFor="transcript" className="cursor-pointer">
                                        {transcriptFile ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                <p className="font-medium">{transcriptFile.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {(transcriptFile.size / 1024 / 1024).toFixed(2)} MB
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
                                <Button
                                    onClick={handleAnalyze}
                                    disabled={!transcriptFile || isAnalyzing}
                                    size="lg"
                                    className="w-full gap-2"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Analyzing Transcript...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4" />
                                            Analyze Transcript
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        /* Analysis Results */
                        <div className="space-y-6">
                            {/* Summary */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BookOpen className="h-5 w-5" />
                                        Executive Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm leading-relaxed">{analysis.summary}</p>
                                </CardContent>
                            </Card>

                            {/* Key Themes */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Key Themes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {analysis.keyThemes.map((theme, i) => (
                                            <div key={i} className="border-l-2 border-primary pl-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm">{theme.theme}</h3>
                                                    <Badge variant={theme.importance === 'high' ? 'default' : 'secondary'}>
                                                        {theme.importance}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{theme.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Witnesses */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Witness Analysis
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {analysis.witnesses.map((witness, i) => (
                                            <div key={i} className="border rounded-lg p-4">
                                                <div className="mb-2">
                                                    <h3 className="font-semibold">{witness.name}</h3>
                                                    <p className="text-sm text-muted-foreground">{witness.role}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-sm font-medium mb-1">Key Testimony:</p>
                                                        <ul className="space-y-1">
                                                            {witness.keyTestimony.map((testimony, j) => (
                                                                <li key={j} className="text-sm flex items-start gap-2">
                                                                    <span className="text-primary mt-0.5">•</span>
                                                                    <span>{testimony}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium mb-1">Credibility Assessment:</p>
                                                        <p className="text-sm text-muted-foreground">{witness.credibilityNotes}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Contradictions */}
                            {analysis.contradictions.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                                            Contradictions & Inconsistencies
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {analysis.contradictions.map((contradiction, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                    <span>{contradiction}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Important Admissions */}
                            {analysis.importantAdmissions.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            Important Admissions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {analysis.importantAdmissions.map((admission, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                    <span>{admission}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Q&A */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5" />
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
                                <FileText className="h-4 w-4" />
                                Analyze New Transcript
                            </Button>
                        </div>
                    )}
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
