"use client"

import { Project } from "@/types"
import { CrossReferenceResult } from "./cross-reference-view"
import { Badge } from "@/components/ui/badge"
import { FileText, AlertTriangle, CheckCircle2, Info } from "lucide-react"

interface CrossReferenceMatrixProps {
    results: CrossReferenceResult[]
    project: Project
    anchorDocumentId: string
}

export function CrossReferenceMatrix({ results, project, anchorDocumentId }: CrossReferenceMatrixProps) {
    const anchorDoc = project.files.find(f => f.id === anchorDocumentId)

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case "High": return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
            case "Medium": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
            case "Low": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
            default: return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
        }
    }

    const getRiskIcon = (risk: string) => {
        switch (risk) {
            case "High":
            case "Medium":
                return <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            case "Low":
                return <Info className="w-3.5 h-3.5 mr-1" />
            default:
                return <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        }
    }

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header Summary */}
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Anchor Reference</h3>
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-primary/10 rounded-md shrink-0">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h4 className="font-medium text-lg mb-1">{anchorDoc?.name || "Unknown Anchor"}</h4>
                            {results.length > 0 && (
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    <span className="font-medium text-foreground">Clause / Topic:</span> {results[0].clauseName} <br/>
                                    <span className="font-medium text-foreground">Anchor Summary:</span> {results[0].anchorSummary}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Target Comparisons */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1">Target Comparisons</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {results.map((res, i) => {
                            const targetDoc = project.files.find(f => f.id === res.targetDocumentId)
                            const riskClass = getRiskColor(res.riskLevel)
                            
                            return (
                                <div key={i} className={`bg-card border rounded-lg overflow-hidden shadow-sm transition-all hover:shadow-md ${res.isContradiction ? "border-l-4 border-l-orange-500" : "border-l-4 border-l-emerald-500"}`}>
                                    {/* Card Header */}
                                    <div className="px-5 py-3 border-b flex justify-between items-center bg-muted/20">
                                        <div className="font-medium flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {targetDoc?.name || "Unknown Target"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {res.isContradiction ? (
                                                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 font-medium">Contradiction / Deviation</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">Aligned</Badge>
                                            )}
                                            <Badge variant="outline" className={`${riskClass} font-medium`}>
                                                {getRiskIcon(res.riskLevel)}
                                                Risk: {res.riskLevel}
                                            </Badge>
                                        </div>
                                    </div>
                                    
                                    {/* Card Body */}
                                    <div className="p-5 flex flex-col md:flex-row gap-6">
                                        {/* Target Summary */}
                                        <div className="flex-1 space-y-2">
                                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Summary</h5>
                                            <p className="text-sm leading-relaxed">{res.targetSummary}</p>
                                        </div>
                                        
                                        {/* Explanation */}
                                        <div className="flex-1 space-y-2 lg:border-l lg:pl-6">
                                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis Explanation</h5>
                                            <p className="text-sm leading-relaxed text-muted-foreground">{res.explanation}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
