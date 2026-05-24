"use client"

import * as React from "react"
import { FileText, Loader2, XCircle, Send, Plus, Minus, RefreshCw, FileEdit, RotateCcw, AlertTriangle, Copy, Check, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"
import { TemplateResultHeader } from "@/components/templates/template-result-header"
import { TemplateProcessing } from "@/components/templates/template-processing"

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

// ─── Section Copy Button ─────────────────────────────────
function SectionCopy({ content }: { content: string }) {
    const [copied, setCopied] = React.useState(false)
    const handleCopy = async () => {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        toast.success("Section copied")
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/section:opacity-100 transition-opacity" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </Button>
    )
}

// ─── Markdown Export ─────────────────────────────────────
function formatRedlineAsMarkdown(r: ComparisonResult): string {
    let md = `# Redline Analysis Report\n\n`
    md += `## Summary\n${r.summary}\n\n`
    md += `## Statistics\n`
    md += `- Total Changes: ${r.statistics?.totalChanges || 0}\n`
    md += `- Additions: ${r.statistics?.addedLines || 0}\n`
    md += `- Deletions: ${r.statistics?.deletedLines || 0}\n`
    md += `- Modifications: ${r.statistics?.modifiedLines || 0}\n\n`
    if (r.changes?.additions?.length) { md += `## Additions (${r.changes.additions.length})\n`; r.changes.additions.forEach(c => { md += `+ ${c}\n` }); md += '\n' }
    if (r.changes?.deletions?.length) { md += `## Deletions (${r.changes.deletions.length})\n`; r.changes.deletions.forEach(c => { md += `- ${c}\n` }); md += '\n' }
    if (r.changes?.modifications?.length) { md += `## Modifications (${r.changes.modifications.length})\n`; r.changes.modifications.forEach(c => { md += `~ ${c}\n` }); md += '\n' }
    return md
}

// ─── Processing steps ────────────────────────────────────
const PROCESSING_STEPS = [
    { label: "Uploading documents", detail: "Preparing original and revised files..." },
    { label: "Extracting text", detail: "Parsing content from both document versions..." },
    { label: "Analyzing redlines", detail: "Identifying additions, deletions, and modifications..." },
]

// ─── Main Component ──────────────────────────────────────
export default function RedlineAnalysis() {
    const {
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isRunning: isProcessing,
        result,
        runWithFile,
        reset,
        error,
        retry,
        generatedAt,
        processingStep,
        elapsedSeconds,
    } = useTemplateWorkflow<ComparisonResult>({
        apiEndpoint: '/api/templates/redline-analysis',
    })

    const [originalFile, setOriginalFile] = React.useState<File | null>(null)
    const [revisedFile, setRevisedFile] = React.useState<File | null>(null)
    const [question, setQuestion] = React.useState("")
    const [conversation, setConversation] = React.useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
    const [isAsking, setIsAsking] = React.useState(false)
    const conversationEndRef = React.useRef<HTMLDivElement>(null)

    // Auto-scroll conversation
    React.useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [conversation])

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

        const formData = new FormData()
        formData.append('original', originalFile)
        formData.append('revised', revisedFile)
        await runWithFile(formData, "Documents compared successfully!")
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
        } catch {
            toast.error("Failed to get answer")
            setConversation(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that question. Please try again." }])
        } finally {
            setIsAsking(false)
        }
    }

    const resetAnalysis = () => {
        setOriginalFile(null)
        setRevisedFile(null)
        setConversation([])
        setQuestion("")
        reset()
    }

    return (
        <ToolPageLayout
            title="Redline Analysis"
            description="Compare document versions and analyze changes with AI"
            icon={<FileEdit className="h-4 w-4" />}
            accentColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
            {isProcessing ? (
                <TemplateProcessing
                    steps={PROCESSING_STEPS}
                    activeStep={processingStep}
                    elapsedSeconds={elapsedSeconds}
                    accentColor="text-indigo-600 dark:text-indigo-400"
                />
            ) : error && !result ? (
                <div className="max-w-md mx-auto text-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">Analysis Failed</h3>
                    <p className="text-sm text-muted-foreground mb-6">{error}</p>
                    <div className="flex items-center justify-center gap-3">
                        <Button onClick={retry} variant="default" className="gap-2"><RotateCcw className="h-4 w-4" /> Retry</Button>
                        <Button onClick={resetAnalysis} variant="outline">Start Over</Button>
                    </div>
                </div>
            ) : !result ? (
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
                            <CardContent className="space-y-3">
                                <FileUploadZone id="original-file" file={originalFile} onFileSelect={(f) => handleFileSelect('original', f)} />
                                {originalFile && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <p className="text-xs font-medium truncate flex-1">{originalFile.name}</p>
                                        <span className="text-[10px] text-muted-foreground">{(originalFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                )}
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
                            <CardContent className="space-y-3">
                                <FileUploadZone id="revised-file" file={revisedFile} onFileSelect={(f) => handleFileSelect('revised', f)} />
                                {revisedFile && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <p className="text-xs font-medium truncate flex-1">{revisedFile.name}</p>
                                        <span className="text-[10px] text-muted-foreground">{(revisedFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                )}
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
                            <><FileEdit className="h-4 w-4" /> Analyze Redlines</>
                        )}
                    </Button>
                </div>
            ) : (
                /* Results Section */
                <div className="space-y-5">
                    <TemplateResultHeader
                        title="Redline Analysis Report"
                        icon={<FileEdit className="h-3.5 w-3.5" />}
                        accentColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        generatedAt={generatedAt || undefined}
                        onReset={resetAnalysis}
                        resetLabel="New Analysis"
                        copyContent={formatRedlineAsMarkdown(result)}
                        downloadContent={formatRedlineAsMarkdown(result)}
                        downloadFilename={`redline-analysis-${new Date().toISOString().split('T')[0]}.md`}
                    />

                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-muted/30">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono">{result.statistics?.totalChanges || 0}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Total Changes</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-500/5 border-emerald-500/20">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{result.statistics?.addedLines || 0}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Additions</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-500/5 border-red-500/20">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{result.statistics?.deletedLines || 0}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Deletions</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-blue-500/5 border-blue-500/20">
                            <CardContent className="pt-5 pb-4 text-center">
                                <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">{result.statistics?.modifiedLines || 0}</div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Modifications</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
                                        <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    Summary
                                    <div className="ml-auto"><SectionCopy content={result.summary} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Changes Details */}
                    <div className="grid md:grid-cols-3 gap-4">
                        {result.changes?.additions?.length > 0 && (
                            <div className="group/section">
                                <Card className="border-emerald-500/20">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-emerald-700 dark:text-emerald-300">Additions</span>
                                            <Badge variant="secondary" className="ml-auto text-[10px]">{result.changes.additions.length}</Badge>
                                            <SectionCopy content={result.changes.additions.join('\n')} />
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
                            </div>
                        )}

                        {result.changes?.deletions?.length > 0 && (
                            <div className="group/section">
                                <Card className="border-red-500/20">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                                            <span className="text-red-700 dark:text-red-300">Deletions</span>
                                            <Badge variant="secondary" className="ml-auto text-[10px]">{result.changes.deletions.length}</Badge>
                                            <SectionCopy content={result.changes.deletions.join('\n')} />
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
                            </div>
                        )}

                        {result.changes?.modifications?.length > 0 && (
                            <div className="group/section">
                                <Card className="border-blue-500/20">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            <span className="text-blue-700 dark:text-blue-300">Modifications</span>
                                            <Badge variant="secondary" className="ml-auto text-[10px]">{result.changes.modifications.length}</Badge>
                                            <SectionCopy content={result.changes.modifications.join('\n')} />
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
                            </div>
                        )}

                        {/* Empty state */}
                        {(!result.changes?.additions?.length && !result.changes?.deletions?.length && !result.changes?.modifications?.length) && (
                            <Card className="col-span-full border-dashed">
                                <CardContent className="py-8 text-center">
                                    <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No significant changes detected between the documents.</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Q&A Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
                                    <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                Ask Questions About Changes
                            </CardTitle>
                            <CardDescription className="ml-9">Ask follow-up questions about the redline changes detected</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {conversation.length > 0 && (
                                <div className="space-y-3 max-h-72 overflow-auto mb-4 pr-2 scroll-smooth">
                                    {conversation.map((msg, i) => (
                                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`rounded-lg px-4 py-2.5 max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isAsking && (
                                        <div className="flex gap-3 justify-start">
                                            <div className="rounded-lg px-4 py-2.5 bg-muted">
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={conversationEndRef} />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="e.g., What are the legal implications of the deleted clauses?"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleAskQuestion()
                                        }
                                    }}
                                    className="min-h-[60px] resize-none"
                                />
                                <Button onClick={handleAskQuestion} disabled={isAsking || !question.trim()} className="shrink-0">
                                    {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                            {conversation.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs gap-1.5"
                                    onClick={() => setConversation([])}
                                >
                                    <XCircle className="h-3 w-3" />
                                    Clear Conversation
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </ToolPageLayout>
    )
}
