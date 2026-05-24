"use client"

import * as React from "react"
import { Loader2, FileText, CheckCircle2, AlertTriangle, DollarSign, Calendar, Shield, ScanSearch, RotateCcw, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"
import { TemplateResultHeader } from "@/components/templates/template-result-header"
import { TemplateProcessing } from "@/components/templates/template-processing"

interface ContractAnalysisResult {
    summary: string
    parties: Array<{
        name: string
        role: string
    }>
    keyTerms: Array<{
        term: string
        description: string
        importance: 'high' | 'medium' | 'low'
    }>
    obligations: Array<{
        party: string
        obligation: string
        deadline?: string
    }>
    financialTerms: Array<{
        type: string
        amount: string
        conditions: string
    }>
    risks: Array<{
        category: string
        description: string
        severity: 'high' | 'medium' | 'low'
    }>
    terminationProvisions: string[]
    unusualClauses: string[]
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

// ─── Stats Summary ───────────────────────────────────────
function AnalysisStats({ analysis }: { analysis: ContractAnalysisResult }) {
    const highRisks = analysis.risks?.filter(r => r.severity === 'high').length || 0
    const mediumRisks = analysis.risks?.filter(r => r.severity === 'medium').length || 0
    const stats = [
        { label: "Parties", value: analysis.parties?.length || 0, color: "text-blue-600 dark:text-blue-400" },
        { label: "Key Terms", value: analysis.keyTerms?.length || 0, color: "text-primary" },
        { label: "Obligations", value: analysis.obligations?.length || 0, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Risks Found", value: analysis.risks?.length || 0, color: highRisks > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400" },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card px-4 py-3 text-center">
                    <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">{stat.label}</p>
                </div>
            ))}
            {highRisks > 0 && (
                <div className="col-span-2 md:col-span-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                        {highRisks} high-severity risk{highRisks > 1 ? 's' : ''}{mediumRisks > 0 ? ` and ${mediumRisks} medium-severity risk${mediumRisks > 1 ? 's' : ''}` : ''} identified
                    </span>
                </div>
            )}
        </div>
    )
}

// ─── Helpers ─────────────────────────────────────────────

const severityBorder: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-emerald-500',
}

const severityBadge: Record<string, 'destructive' | 'default' | 'secondary'> = {
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
}

function formatResultAsMarkdown(analysis: ContractAnalysisResult): string {
    let md = `# Contract Analysis Report\n\n`
    md += `## Executive Summary\n${analysis.summary}\n\n`

    if (analysis.parties?.length) {
        md += `## Parties\n`
        analysis.parties.forEach(p => { md += `- **${p.name}** — ${p.role}\n` })
        md += '\n'
    }

    if (analysis.keyTerms?.length) {
        md += `## Key Terms\n`
        analysis.keyTerms.forEach(t => { md += `- **${t.term}** (${t.importance}): ${t.description}\n` })
        md += '\n'
    }

    if (analysis.obligations?.length) {
        md += `## Obligations\n`
        analysis.obligations.forEach(o => { md += `- [${o.party}] ${o.obligation}${o.deadline ? ` — Deadline: ${o.deadline}` : ''}\n` })
        md += '\n'
    }

    if (analysis.financialTerms?.length) {
        md += `## Financial Terms\n`
        analysis.financialTerms.forEach(f => { md += `- **${f.type}**: ${f.amount} — ${f.conditions}\n` })
        md += '\n'
    }

    if (analysis.risks?.length) {
        md += `## Risks\n`
        analysis.risks.forEach(r => { md += `- [${r.severity.toUpperCase()}] **${r.category}**: ${r.description}\n` })
        md += '\n'
    }

    if (analysis.terminationProvisions?.length) {
        md += `## Termination Provisions\n`
        analysis.terminationProvisions.forEach((p, i) => { md += `${i + 1}. ${p}\n` })
        md += '\n'
    }

    if (analysis.unusualClauses?.length) {
        md += `## Unusual Clauses\n`
        analysis.unusualClauses.forEach(c => { md += `- ⚠️ ${c}\n` })
        md += '\n'
    }

    if (analysis.recommendations?.length) {
        md += `## Recommendations\n`
        analysis.recommendations.forEach(r => { md += `- ✅ ${r}\n` })
    }

    return md
}

// ─── Processing steps ────────────────────────────────────
const PROCESSING_STEPS = [
    { label: "Uploading document", detail: "Preparing file for analysis..." },
    { label: "Extracting text", detail: "Parsing document content and structure..." },
    { label: "Analyzing contract", detail: "Identifying parties, terms, obligations, and risks..." },
]

// ─── Main Component ──────────────────────────────────────
export default function ContractAnalysis() {
    const {
        file: contractFile,
        handleFileSelect,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isRunning: isAnalyzing,
        result: analysis,
        runWithFile,
        reset: resetAnalysis,
        error,
        retry,
        generatedAt,
        processingStep,
        elapsedSeconds,
    } = useTemplateWorkflow<ContractAnalysisResult>({
        apiEndpoint: '/api/templates/contract-analysis',
    })

    const handleAnalyze = async () => {
        if (!contractFile) {
            toast.error("Please upload a contract")
            return
        }

        const formData = new FormData()
        formData.append('file', contractFile)
        await runWithFile(formData, "Contract analyzed successfully!")
    }

    return (
        <ToolPageLayout
            title="Contract Analysis"
            description="Comprehensive contract review and risk assessment"
            icon={<ScanSearch className="h-4 w-4" />}
            accentColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        >
            {isAnalyzing ? (
                /* ─── Processing Phase ──────────────────────── */
                <TemplateProcessing
                    steps={PROCESSING_STEPS}
                    activeStep={processingStep}
                    elapsedSeconds={elapsedSeconds}
                    accentColor="text-blue-600 dark:text-blue-400"
                />
            ) : error && !analysis ? (
                /* ─── Error State ───────────────────────────── */
                <div className="max-w-md mx-auto text-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">Analysis Failed</h3>
                    <p className="text-sm text-muted-foreground mb-6">{error}</p>
                    <div className="flex items-center justify-center gap-3">
                        <Button onClick={retry} variant="default" className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Retry
                        </Button>
                        <Button onClick={resetAnalysis} variant="outline">Start Over</Button>
                    </div>
                </div>
            ) : !analysis ? (
                /* ─── Upload Section ────────────────────────── */
                <Card className="max-w-2xl mx-auto border-dashed">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" />
                            Upload Contract
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Upload a contract document for AI-powered comprehensive analysis</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FileUploadZone id="contract" file={contractFile} onFileSelect={handleFileSelect} />

                        {contractFile && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{contractFile.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {(contractFile.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={handleAnalyze}
                            disabled={!contractFile || isAnalyzing}
                            size="lg"
                            className="w-full gap-2"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analyzing Contract...
                                </>
                            ) : (
                                <>
                                    <ScanSearch className="h-4 w-4" />
                                    Analyze Contract
                                </>
                            )}
                        </Button>

                        {/* Analysis scope info */}
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Analysis Scope</p>
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {['Parties & Roles', 'Key Terms & Definitions', 'Obligations & Deadlines', 'Financial Terms', 'Risk Assessment', 'Termination Clauses', 'Unusual Provisions', 'Recommendations'].map(item => (
                                    <li key={item} className="text-[11px] flex items-center gap-1.5 text-muted-foreground/80">
                                        <div className="h-1 w-1 rounded-full bg-blue-500/40" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* ─── Analysis Results ──────────────────────── */
                <div className="space-y-5">
                    {/* Sticky Result Header */}
                    <TemplateResultHeader
                        title="Contract Analysis Report"
                        icon={<ScanSearch className="h-3.5 w-3.5" />}
                        accentColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        generatedAt={generatedAt || undefined}
                        onReset={resetAnalysis}
                        resetLabel="New Analysis"
                        copyContent={formatResultAsMarkdown(analysis)}
                        downloadContent={formatResultAsMarkdown(analysis)}
                        downloadFilename={`contract-analysis-${new Date().toISOString().split('T')[0]}.md`}
                    />

                    {/* Key Metrics */}
                    <AnalysisStats analysis={analysis} />

                    {/* Summary */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    Executive Summary
                                    <div className="ml-auto"><SectionCopy content={analysis.summary} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Parties */}
                    {analysis.parties?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span>Parties</span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px]">{analysis.parties.length}</Badge>
                                            <SectionCopy content={analysis.parties.map(p => `${p.name} — ${p.role}`).join('\n')} />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {analysis.parties.map((party, i) => (
                                            <div key={i} className="rounded-lg border bg-muted/30 p-4">
                                                <p className="font-semibold text-sm">{party.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{party.role}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Key Terms */}
                    {analysis.keyTerms?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span>Key Terms</span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px]">{analysis.keyTerms.length}</Badge>
                                            <SectionCopy content={analysis.keyTerms.map(t => `${t.term} (${t.importance}): ${t.description}`).join('\n')} />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {analysis.keyTerms.map((term, i) => (
                                            <div key={i} className={`border-l-2 ${term.importance === 'high' ? 'border-l-primary' : 'border-l-muted-foreground/30'} pl-4 py-0.5`}>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="font-semibold text-sm">{term.term}</h3>
                                                    <Badge variant={term.importance === 'high' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                                        {term.importance}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{term.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Obligations */}
                    {analysis.obligations?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        Obligations
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{analysis.obligations.length}</Badge>
                                        <SectionCopy content={analysis.obligations.map(o => `[${o.party}] ${o.obligation}${o.deadline ? ` — ${o.deadline}` : ''}`).join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2.5">
                                        {analysis.obligations.map((obligation, i) => (
                                            <div key={i} className="flex items-start gap-3 text-sm">
                                                <Badge variant="outline" className="shrink-0 mt-0.5 text-[11px] font-medium">
                                                    {obligation.party}
                                                </Badge>
                                                <div className="flex-1">
                                                    <span className="text-foreground/90">{obligation.obligation}</span>
                                                    {obligation.deadline && (
                                                        <span className="text-muted-foreground ml-1.5 text-xs">— {obligation.deadline}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Financial Terms */}
                    {analysis.financialTerms?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-green-500/10 flex items-center justify-center">
                                            <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                        </div>
                                        Financial Terms
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{analysis.financialTerms.length}</Badge>
                                        <SectionCopy content={analysis.financialTerms.map(f => `${f.type}: ${f.amount} — ${f.conditions}`).join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {analysis.financialTerms.map((term, i) => (
                                            <div key={i} className="rounded-lg border bg-green-500/5 p-3.5">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="font-medium text-sm">{term.type}</span>
                                                    <span className="font-bold text-sm font-mono text-green-700 dark:text-green-400">{term.amount}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{term.conditions}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Risks */}
                    {analysis.risks?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        Risk Assessment
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{analysis.risks.length}</Badge>
                                        <SectionCopy content={analysis.risks.map(r => `[${r.severity}] ${r.category}: ${r.description}`).join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {analysis.risks.map((risk, i) => (
                                            <div key={i} className={`border-l-2 ${severityBorder[risk.severity] || 'border-l-muted'} pl-4 py-0.5`}>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <Badge variant={severityBadge[risk.severity] || 'secondary'} className="text-[10px] px-1.5 py-0">
                                                        {risk.severity}
                                                    </Badge>
                                                    <span className="text-sm font-medium">{risk.category}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{risk.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Termination Provisions */}
                    {analysis.terminationProvisions?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                                            <Calendar className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        Termination Provisions
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{analysis.terminationProvisions.length}</Badge>
                                        <SectionCopy content={analysis.terminationProvisions.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {analysis.terminationProvisions.map((provision, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm">
                                                <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">{i + 1}</span>
                                                <span className="text-foreground/90">{provision}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Unusual Clauses */}
                    {analysis.unusualClauses?.length > 0 && (
                        <div className="group/section">
                            <Card className="border-amber-500/30">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                            <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        Unusual or Notable Clauses
                                        <Badge variant="destructive" className="ml-auto text-[10px]">{analysis.unusualClauses.length}</Badge>
                                        <SectionCopy content={analysis.unusualClauses.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2.5">
                                        {analysis.unusualClauses.map((clause, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm rounded-md bg-amber-500/5 p-3">
                                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <span className="text-foreground/90">{clause}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Recommendations */}
                    {analysis.recommendations?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        Recommendations
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{analysis.recommendations.length}</Badge>
                                        <SectionCopy content={analysis.recommendations.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {analysis.recommendations.map((rec, i) => (
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

                    {/* Empty state for any missing sections */}
                    {(!analysis.risks || analysis.risks.length === 0) &&
                     (!analysis.obligations || analysis.obligations.length === 0) && (
                        <Card className="border-dashed">
                            <CardContent className="py-8 text-center">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                                <p className="text-sm font-medium">No significant risks or obligations identified</p>
                                <p className="text-xs text-muted-foreground mt-1">This contract appears to have standard terms</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </ToolPageLayout>
    )
}
