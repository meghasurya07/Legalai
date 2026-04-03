/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState } from "react"
import { Project } from "@/types"
import { CrossReferenceToolbar } from "./cross-reference-toolbar"
import { CrossReferenceMatrix } from "./cross-reference-matrix"
import { Loader2 } from "lucide-react"

export interface CrossReferenceResult {
    targetDocumentId: string
    clauseName: string
    anchorSummary: string
    targetSummary: string
    isContradiction: boolean
    riskLevel: "None" | "Low" | "Medium" | "High"
    explanation: string
}

interface CrossReferenceViewProps {
    project: Project
    projectId: string
}

export function CrossReferenceView({ project, projectId }: CrossReferenceViewProps) {
    const [anchorDocumentId, setAnchorDocumentId] = useState<string>("")
    const [targetDocumentIds, setTargetDocumentIds] = useState<string[]>([])
    const [prompt, setPrompt] = useState("")

    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [results, setResults] = useState<CrossReferenceResult[]>([])

    const handleAnalyze = async () => {
        if (!anchorDocumentId || targetDocumentIds.length === 0 || !prompt.trim()) return

        setIsAnalyzing(true)

        try {
            const anchorDoc = project.files.find(f => f.id === anchorDocumentId)
            const targetDocs = project.files.filter(f => targetDocumentIds.includes(f.id))
            
            if (!anchorDoc) throw new Error("Anchor document not found")

            // We assume extracted_text exists because it's processed after upload
            const response = await fetch("/api/cross-reference/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    prompt,
                    anchorDocument: {
                        id: anchorDoc.id,
                        name: anchorDoc.name,
                        text: anchorDoc.extracted_text || ""
                    },
                    targetDocuments: targetDocs.map(doc => ({
                        id: doc.id,
                        name: doc.name,
                        text: doc.extracted_text || ""
                    }))
                })
            })

            if (!response.ok) throw new Error("Failed to analyze cross-references")

            const data = await response.json()
            setResults(data.results || [])
        } catch (error) {
            // Handle error toast here
        } finally {
            setIsAnalyzing(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background rounded-l-md overflow-hidden relative">
            <CrossReferenceToolbar 
                project={project}
                anchorDocumentId={anchorDocumentId}
                setAnchorDocumentId={setAnchorDocumentId}
                targetDocumentIds={targetDocumentIds}
                setTargetDocumentIds={setTargetDocumentIds}
                prompt={prompt}
                setPrompt={setPrompt}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
            />

            <div className="flex-1 overflow-auto relative bg-muted/20">
                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-70">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Cross-referencing documents...</p>
                        <p className="text-xs text-muted-foreground">Checking clauses against the anchor document.</p>
                    </div>
                ) : results.length > 0 ? (
                    <CrossReferenceMatrix 
                        results={results}
                        project={project} 
                        anchorDocumentId={anchorDocumentId} 
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-primary font-bold text-lg">⚖️</span>
                        </div>
                        <h3 className="font-semibold text-foreground mb-1">Multi-Document Cross-Reference</h3>
                        <p className="text-sm mb-6">Select an anchor document and multiple target documents. Ask a question to compare clauses and spot contradictions.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
