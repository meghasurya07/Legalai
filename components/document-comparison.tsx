"use client"

import * as React from "react"
import { Loader2, FileText, CheckCircle2, AlertTriangle, Scale, Shield, Copy, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"
import { FileUploadZone } from "@/components/ui/file-upload-zone"

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

export default function DocumentComparison() {
    const [document1, setDocument1] = React.useState<File | null>(null)
    const [document2, setDocument2] = React.useState<File | null>(null)
    const [isComparing, setIsComparing] = React.useState(false)
    const [result, setResult] = React.useState<ComparisonResult | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)

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

        setIsComparing(true)
        const formData = new FormData()
        formData.append('document1', document1)
        formData.append('document2', document2)

        try {
            const response = await fetch('/api/templates/document-comparison', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to compare documents')
            }

            const data = await response.json()
            setResult(data)
            toast.success("Documents compared successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to compare documents"
            toast.error(message)
        } finally {
            setIsComparing(false)
        }
    }

    const resetComparison = () => {
        setDocument1(null)
        setDocument2(null)
        setResult(null)
    }

    return (
        <ToolPageLayout
            title="Document Comparison"
            description="Compare legal documents and identify material differences"
            icon={<Copy className="h-4 w-4" />}
            accentColor="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        >

            {!result ? (
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
                            <CardContent>
                                <FileUploadZone id="document1" file={document1} onFileSelect={(f) => handleFileSelect(1, f)} />
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
                            <CardContent>
                                <FileUploadZone id="document2" file={document2} onFileSelect={(f) => handleFileSelect(2, f)} />
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
                    {/* Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-sky-500/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                                </div>
                                Comparison Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Material Changes */}
                    {result.materialChanges.length > 0 && (
                        <Card className="border-amber-500/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    Material Changes
                                    <Badge variant="destructive" className="ml-auto text-[10px]">{result.materialChanges.length}</Badge>
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
                    )}

                    {/* Minor Changes */}
                    {result.minorChanges.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    Minor Changes
                                    <Badge variant="secondary" className="ml-auto text-[10px]">{result.minorChanges.length}</Badge>
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
                    )}

                    {/* Legal Implications */}
                    {result.legalImplications.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                                        <Scale className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    Legal Implications
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
                    )}

                    {/* Risk Assessment */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-slate-500/10 flex items-center justify-center">
                                    <Shield className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                                </div>
                                Risk Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {result.riskAssessment.increased.length > 0 && (
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
                            {result.riskAssessment.decreased.length > 0 && (
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
                        </CardContent>
                    </Card>

                    {/* Recommendations */}
                    {result.recommendations.length > 0 && (
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
                    )}

                    <Button onClick={resetComparison} variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        New Comparison
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

