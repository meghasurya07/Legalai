"use client"

import * as React from "react"
import { Loader2, FileText, CheckCircle2, AlertTriangle, Scale, Shield, Copy, ArrowUpDown, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"
import { TemplateResultHeader } from "@/components/templates/template-result-header"
import { TemplateProcessing } from "@/components/templates/template-processing"

interface ComparisonResult {
    summary: string
    materialChanges: string[]
    minorChanges: string[]
    legalImplications: string[]
    riskAssessment: {
        increased: string[]
        decreased: string[]
        unchanged: string[]
    }
    recommendations: string[]
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
function formatComparisonAsMarkdown(r: ComparisonResult): string {
    let md = `# Document Comparison Report\n\n## Summary\n${r.summary}\n\n`
    if (r.materialChanges?.length) { md += `## Material Changes (${r.materialChanges.length})\n`; r.materialChanges.forEach(c => { md += `- ⚠️ ${c}\n` }); md += '\n' }
    if (r.minorChanges?.length) { md += `## Minor Changes (${r.minorChanges.length})\n`; r.minorChanges.forEach(c => { md += `- ${c}\n` }); md += '\n' }
    if (r.legalImplications?.length) { md += `## Legal Implications\n`; r.legalImplications.forEach((i, n) => { md += `${n + 1}. ${i}\n` }); md += '\n' }
    md += `## Risk Assessment\n`
    if (r.riskAssessment?.increased?.length) { md += `### Increased Risks\n`; r.riskAssessment.increased.forEach(ri => { md += `- 🔴 ${ri}\n` }) }
    if (r.riskAssessment?.decreased?.length) { md += `### Decreased Risks\n`; r.riskAssessment.decreased.forEach(ri => { md += `- 🟢 ${ri}\n` }) }
    if (r.riskAssessment?.unchanged?.length) { md += `### Unchanged Risks\n`; r.riskAssessment.unchanged.forEach(ri => { md += `- ⚪ ${ri}\n` }) }
    md += '\n'
    if (r.recommendations?.length) { md += `## Recommendations\n`; r.recommendations.forEach(rec => { md += `- ✅ ${rec}\n` }) }
    return md
}

// ─── Processing steps ────────────────────────────────────
const PROCESSING_STEPS = [
    { label: "Uploading documents", detail: "Preparing both files for comparison..." },
    { label: "Extracting text", detail: "Parsing content from both documents..." },
    { label: "Analyzing differences", detail: "Identifying material changes, legal implications, and risks..." },
]

// ─── Stats Summary ───────────────────────────────────────
function ComparisonStats({ result }: { result: ComparisonResult }) {
    const stats = [
        { label: "Material Changes", value: result.materialChanges?.length || 0, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
        { label: "Minor Changes", value: result.minorChanges?.length || 0, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/5 border-blue-500/20" },
        { label: "Increased Risks", value: result.riskAssessment?.increased?.length || 0, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/5 border-red-500/20" },
        { label: "Decreased Risks", value: result.riskAssessment?.decreased?.length || 0, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/20" },
    ]
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map(stat => (
                <div key={stat.label} className={`rounded-lg border ${stat.bg} px-4 py-3 text-center`}>
                    <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">{stat.label}</p>
                </div>
            ))}
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────
export default function DocumentComparison() {
    const {
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isRunning: isComparing,
        result,
        runWithFile,
        reset,
        error,
        retry,
        generatedAt,
        processingStep,
        elapsedSeconds,
    } = useTemplateWorkflow<ComparisonResult>({
        apiEndpoint: '/api/templates/document-comparison',
    })

    const [document1, setDocument1] = React.useState<File | null>(null)
    const [document2, setDocument2] = React.useState<File | null>(null)

    const handleFileSelect = (position: 1 | 2, file: File) => {
        if ((position === 1 && document2 && document2.name === file.name) ||
            (position === 2 && document1 && document1.name === file.name) ||
            (position === 1 && document1 && document1.name === file.name) ||
            (position === 2 && document2 && document2.name === file.name)) {
            setIsDuplicateModalOpen(true)
            return
        }
        if (position === 1) {
            setDocument1(file)
        } else {
            setDocument2(file)
        }
        toast.success(`Document ${position} uploaded`)
    }

    const handleCompare = async () => {
        if (!document1 || !document2) {
            toast.error("Please upload both documents")
            return
        }

        const formData = new FormData()
        formData.append('document1', document1)
        formData.append('document2', document2)
        await runWithFile(formData, "Documents compared successfully!")
    }

    const resetComparison = () => {
        setDocument1(null)
        setDocument2(null)
        reset()
    }

    return (
        <ToolPageLayout
            title="Document Comparison"
            description="Compare legal documents and identify material differences"
            icon={<Copy className="h-4 w-4" />}
            accentColor="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        >
            {isComparing ? (
                <TemplateProcessing
                    steps={PROCESSING_STEPS}
                    activeStep={processingStep}
                    elapsedSeconds={elapsedSeconds}
                    accentColor="text-sky-600 dark:text-sky-400"
                />
            ) : error && !result ? (
                <div className="max-w-md mx-auto text-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">Comparison Failed</h3>
                    <p className="text-sm text-muted-foreground mb-6">{error}</p>
                    <div className="flex items-center justify-center gap-3">
                        <Button onClick={retry} variant="default" className="gap-2"><RotateCcw className="h-4 w-4" /> Retry</Button>
                        <Button onClick={resetComparison} variant="outline">Start Over</Button>
                    </div>
                </div>
            ) : !result ? (
                /* Upload Section */
                <div className="space-y-5 max-w-4xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card className="border-dashed">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">A</Badge>
                                    <CardTitle className="text-base">Original Document</CardTitle>
                                </div>
                                <CardDescription>Upload the original or base document</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <FileUploadZone id="document1" file={document1} onFileSelect={(f) => handleFileSelect(1, f)} />
                                {document1 && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <p className="text-xs font-medium truncate">{document1.name}</p>
                                        <span className="text-[10px] text-muted-foreground ml-auto">{(document1.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-dashed">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">B</Badge>
                                    <CardTitle className="text-base">Revised Document</CardTitle>
                                </div>
                                <CardDescription>Upload the revised or comparison document</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <FileUploadZone id="document2" file={document2} onFileSelect={(f) => handleFileSelect(2, f)} />
                                {document2 && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <p className="text-xs font-medium truncate">{document2.name}</p>
                                        <span className="text-[10px] text-muted-foreground ml-auto">{(document2.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Button
                        onClick={handleCompare}
                        disabled={!document1 || !document2 || isComparing}
                        size="lg"
                        className="w-full gap-2"
                    >
                        {isComparing ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Comparing Documents...</>
                        ) : (
                            <><ArrowUpDown className="h-4 w-4" /> Compare Documents</>
                        )}
                    </Button>
                </div>
            ) : (
                /* Results Section */
                <div className="space-y-5">
                    <TemplateResultHeader
                        title="Document Comparison Report"
                        icon={<ArrowUpDown className="h-3.5 w-3.5" />}
                        accentColor="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        generatedAt={generatedAt || undefined}
                        onReset={resetComparison}
                        resetLabel="New Comparison"
                        copyContent={formatComparisonAsMarkdown(result)}
                        downloadContent={formatComparisonAsMarkdown(result)}
                        downloadFilename={`document-comparison-${new Date().toISOString().split('T')[0]}.md`}
                    />

                    <ComparisonStats result={result} />

                    {/* Summary */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-sky-500/10 flex items-center justify-center">
                                        <FileText className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                                    </div>
                                    Comparison Summary
                                    <div className="ml-auto"><SectionCopy content={result.summary} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Material Changes */}
                    {result.materialChanges?.length > 0 && (
                        <div className="group/section">
                            <Card className="border-amber-500/30">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        Material Changes
                                        <Badge variant="destructive" className="ml-auto text-[10px]">{result.materialChanges.length}</Badge>
                                        <SectionCopy content={result.materialChanges.join('\n')} />
                                    </CardTitle>
                                    <CardDescription className="ml-9">Significant differences that require attention</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2.5">
                                        {result.materialChanges.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm rounded-md bg-amber-500/5 p-3">
                                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <span className="text-foreground/90">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Minor Changes */}
                    {result.minorChanges?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        Minor Changes
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.minorChanges.length}</Badge>
                                        <SectionCopy content={result.minorChanges.join('\n')} />
                                    </CardTitle>
                                    <CardDescription className="ml-9">Non-material differences</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {result.minorChanges.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm border-l-2 border-blue-500/30 pl-3 py-0.5">
                                                <span className="text-foreground/90">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Legal Implications */}
                    {result.legalImplications?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                                            <Scale className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        Legal Implications
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.legalImplications.length}</Badge>
                                        <SectionCopy content={result.legalImplications.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {result.legalImplications.map((implication, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm">
                                                <span className="h-5 w-5 rounded-full bg-purple-500/10 flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">{i + 1}</span>
                                                <span className="text-foreground/90">{implication}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Risk Assessment — now renders ALL three categories including unchanged */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-slate-500/10 flex items-center justify-center">
                                        <Shield className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    Risk Assessment
                                    <div className="ml-auto"><SectionCopy content={[...(result.riskAssessment?.increased || []).map(r => `[INCREASED] ${r}`), ...(result.riskAssessment?.decreased || []).map(r => `[DECREASED] ${r}`), ...(result.riskAssessment?.unchanged || []).map(r => `[UNCHANGED] ${r}`)].join('\n')} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {result.riskAssessment?.increased?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-red-600 dark:text-red-400 mb-2">Increased Risks</p>
                                        <ul className="space-y-1.5">
                                            {result.riskAssessment.increased.map((risk, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm border-l-2 border-red-500/40 pl-3 py-0.5">
                                                    <span className="text-foreground/90">{risk}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {result.riskAssessment?.decreased?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-2">Decreased Risks</p>
                                        <ul className="space-y-1.5">
                                            {result.riskAssessment.decreased.map((risk, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm border-l-2 border-emerald-500/40 pl-3 py-0.5">
                                                    <span className="text-foreground/90">{risk}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {result.riskAssessment?.unchanged?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Unchanged Risks</p>
                                        <ul className="space-y-1.5">
                                            {result.riskAssessment.unchanged.map((risk, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm border-l-2 border-border pl-3 py-0.5">
                                                    <span className="text-foreground/70">{risk}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {(!result.riskAssessment?.increased?.length && !result.riskAssessment?.decreased?.length && !result.riskAssessment?.unchanged?.length) && (
                                    <p className="text-sm text-muted-foreground italic">No specific risk changes identified between the documents.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recommendations */}
                    {result.recommendations?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        Recommendations
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.recommendations.length}</Badge>
                                        <SectionCopy content={result.recommendations.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {result.recommendations.map((rec, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm">
                                                <span className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                </span>
                                                <span className="text-foreground/90">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </ToolPageLayout>
    )
}
