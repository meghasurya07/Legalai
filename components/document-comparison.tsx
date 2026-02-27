"use client"

import * as React from "react"
import { Upload, ArrowLeft, Loader2, FileText, CheckCircle2, AlertTriangle, Scale, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"

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
    const router = useRouter()
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
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 pb-32">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/templates')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">Document Comparison</h1>
                            <p className="text-muted-foreground">Compare legal documents and identify material differences</p>
                        </div>
                    </div>

                    {!result ? (
                        /* Upload Section */
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Document 1 */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Document 1</CardTitle>
                                        <CardDescription>Upload the first document</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                                            <input
                                                type="file"
                                                id="document1"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleFileSelect(1, e.target.files[0])}
                                            />
                                            <label htmlFor="document1" className="cursor-pointer">
                                                {document1 ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                        <p className="font-medium">{document1.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {(document1.size / 1024 / 1024).toFixed(2)} MB
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

                                {/* Document 2 */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Document 2</CardTitle>
                                        <CardDescription>Upload the second document</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                                            <input
                                                type="file"
                                                id="document2"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleFileSelect(2, e.target.files[0])}
                                            />
                                            <label htmlFor="document2" className="cursor-pointer">
                                                {document2 ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                        <p className="font-medium">{document2.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {(document2.size / 1024 / 1024).toFixed(2)} MB
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

                            <Button
                                onClick={handleCompare}
                                disabled={!document1 || !document2 || isComparing}
                                size="lg"
                                className="gap-2"
                            >
                                {isComparing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Comparing Documents...
                                    </>
                                ) : (
                                    <>
                                        <Scale className="h-4 w-4" />
                                        Compare Documents
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        /* Results Section */
                        <div className="space-y-6">
                            {/* Summary */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Comparison Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm leading-relaxed">{result.summary}</p>
                                </CardContent>
                            </Card>

                            {/* Material Changes */}
                            {result.materialChanges.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                                            Material Changes
                                        </CardTitle>
                                        <CardDescription>Significant differences that require attention</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {result.materialChanges.map((change, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                    <span>{change}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Minor Changes */}
                            {result.minorChanges.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-blue-500" />
                                            Minor Changes
                                        </CardTitle>
                                        <CardDescription>Non-material differences</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {result.minorChanges.map((change, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <span className="text-blue-500 mt-0.5">•</span>
                                                    <span>{change}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Legal Implications */}
                            {result.legalImplications.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Scale className="h-5 w-5" />
                                            Legal Implications
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {result.legalImplications.map((implication, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <Scale className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                                                    <span>{implication}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Risk Assessment */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="h-5 w-5" />
                                        Risk Assessment
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {result.riskAssessment.increased.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2 text-red-600">Increased Risks:</p>
                                            <ul className="space-y-1.5">
                                                {result.riskAssessment.increased.map((risk, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm">
                                                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                        <span>{risk}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {result.riskAssessment.decreased.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2 text-green-600">Decreased Risks:</p>
                                            <ul className="space-y-1.5">
                                                {result.riskAssessment.decreased.map((risk, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm">
                                                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                        <span>{risk}</span>
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
                                    <CardHeader>
                                        <CardTitle>Recommendations</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {result.recommendations.map((rec, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <span className="text-primary mt-0.5">→</span>
                                                    <span>{rec}</span>
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
