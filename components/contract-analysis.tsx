/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import { Loader2, FileText, CheckCircle2, AlertTriangle, DollarSign, Calendar, Shield, ScanSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useParams } from "next/navigation"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"

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

export default function ContractAnalysis() {
    const params = useParams()
    const chatIdParam = params.chatId as string[] | undefined
    const chatId = chatIdParam && chatIdParam[0] === 'chat' && chatIdParam[1] ? chatIdParam[1] : undefined

    const [contractFile, setContractFile] = React.useState<File | null>(null)
    const [isAnalyzing, setIsAnalyzing] = React.useState(false)
    const [analysis, setAnalysis] = React.useState<ContractAnalysisResult | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)

    // Load history if chatId is present
    React.useEffect(() => {
        if (!chatId) return

        const loadHistory = async () => {
            setIsAnalyzing(true)
            try {
                const res = await fetch(`/api/chat/conversations/${chatId}/messages`)
                if (res.ok) {
                    const messages = await res.json()
                    // Find the assistant message with the JSON result
                    const assistantMsg = messages.find((m: { role: string; content: string }) => m.role === 'assistant')
                    if (assistantMsg) {
                        try {
                            const parsedData = JSON.parse(assistantMsg.content)
                            setAnalysis(parsedData)
                        } catch (e) {
                            toast.error("Failed to load past result")
                        }
                    }
                }
            } catch (error) {
            } finally {
                setIsAnalyzing(false)
            }
        }

        loadHistory()
    }, [chatId])

    const handleFileSelect = (file: File) => {
        if (contractFile && contractFile.name === file.name) {
            setIsDuplicateModalOpen(true)
            return
        }
        setContractFile(file)
        toast.success("Contract uploaded")
    }

    const handleAnalyze = async () => {
        if (!contractFile) {
            toast.error("Please upload a contract")
            return
        }

        setIsAnalyzing(true)
        const formData = new FormData()
        formData.append('contract', contractFile)

        try {
            const response = await fetch('/api/templates/contract-analysis', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to analyze contract')
            }

            const data = await response.json()
            setAnalysis(data)
            toast.success("Contract analyzed successfully!")
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to analyze contract"
            toast.error(message)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const resetAnalysis = () => {
        setContractFile(null)
        setAnalysis(null)
    }


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

    return (
        <ToolPageLayout
            title="Contract Analysis"
            description="Comprehensive contract review and risk assessment"
            icon={<ScanSearch className="h-4 w-4" />}
            accentColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        >

            {!analysis ? (
                /* Upload Section */
                <Card className="max-w-2xl mx-auto border-dashed">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" />
                            Upload Contract
                        </CardTitle>
                        <CardDescription>Upload a contract document for AI-powered comprehensive analysis</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FileUploadZone id="contract" file={contractFile} onFileSelect={handleFileSelect} />
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
                    </CardContent>
                </Card>
            ) : (
                /* Analysis Results */
                <div className="space-y-5">
                    {/* Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </div>
                                Executive Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Parties */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Parties</CardTitle>
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

                    {/* Key Terms */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Key Terms</CardTitle>
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

                    {/* Obligations */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Obligations
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

                    {/* Financial Terms */}
                    {analysis.financialTerms.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-green-500/10 flex items-center justify-center">
                                        <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                    </div>
                                    Financial Terms
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
                    )}

                    {/* Risks */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                </div>
                                Risk Assessment
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

                    {/* Termination Provisions */}
                    {analysis.terminationProvisions.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                                        <Calendar className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    Termination Provisions
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
                    )}

                    {/* Unusual Clauses */}
                    {analysis.unusualClauses.length > 0 && (
                        <Card className="border-amber-500/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                        <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    Unusual or Notable Clauses
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
                    )}

                    {/* Recommendations */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Recommendations
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

                    <Button onClick={resetAnalysis} variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Analyze New Contract
                    </Button>
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

