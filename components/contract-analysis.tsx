"use client"

import * as React from "react"
import { Loader2, FileText, CheckCircle2, AlertTriangle, DollarSign, Calendar, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"
import { FileUploadZone } from "@/components/ui/file-upload-zone"

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
    const searchParams = useSearchParams()
    const chatId = searchParams.get('chatId')

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
                            console.error("Failed to parse history content:", e)
                            toast.error("Failed to load past result")
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch history:", error)
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
            console.error(error)
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


    return (
        <ToolPageLayout title="Contract Analysis" description="Comprehensive contract review and risk assessment">

            {!analysis ? (
                /* Upload Section */
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>Upload Contract</CardTitle>
                        <CardDescription>Upload a contract for comprehensive analysis</CardDescription>
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
                                    <FileText className="h-4 w-4" />
                                    Analyze Contract
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
                                <FileText className="h-5 w-5" />
                                Contract Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed">{analysis.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Parties */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Parties</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                {analysis.parties.map((party, i) => (
                                    <div key={i} className="border rounded-lg p-4">
                                        <p className="font-semibold">{party.name}</p>
                                        <p className="text-sm text-muted-foreground">{party.role}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Key Terms */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Key Terms</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {analysis.keyTerms.map((term, i) => (
                                    <div key={i} className="border-l-2 border-primary pl-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-sm">{term.term}</h3>
                                            <Badge variant={term.importance === 'high' ? 'default' : 'secondary'}>
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
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5" />
                                Obligations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {analysis.obligations.map((obligation, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                        <span className="font-semibold text-primary min-w-[120px]">{obligation.party}:</span>
                                        <div className="flex-1">
                                            <span>{obligation.obligation}</span>
                                            {obligation.deadline && (
                                                <span className="text-muted-foreground ml-2">({obligation.deadline})</span>
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
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5" />
                                    Financial Terms
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {analysis.financialTerms.map((term, i) => (
                                        <div key={i} className="border rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-sm">{term.type}</span>
                                                <span className="font-bold text-green-600">{term.amount}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{term.conditions}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Risks */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Risk Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {analysis.risks.map((risk, i) => (
                                    <div key={i} className="border-l-2 border-amber-500 pl-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={risk.severity === 'high' ? 'destructive' : 'secondary'}>
                                                {risk.severity} risk
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
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Termination Provisions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {analysis.terminationProvisions.map((provision, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-primary mt-0.5">•</span>
                                            <span>{provision}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Unusual Clauses */}
                    {analysis.unusualClauses.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Unusual or Notable Clauses
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {analysis.unusualClauses.map((clause, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                            <span>{clause}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommendations */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {analysis.recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <span className="text-green-600 mt-0.5">→</span>
                                        <span>{rec}</span>
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
