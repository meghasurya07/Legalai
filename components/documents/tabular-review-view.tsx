"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Project, DocumentFile } from "@/types"
import { TabularReviewToolbar } from "./tabular-review-toolbar"
import { TabularReviewGrid } from "./tabular-review-grid"
import { TabularReviewChat } from "./tabular-review-chat"
import { toast } from "sonner"

export interface ReviewColumn {
    id: string
    name: string
    prompt: string
    width: number
    order: number
}

export interface ReviewCell {
    documentId: string
    columnId: string
    content: string
    status: "pending" | "processing" | "completed" | "error"
}

export interface TabularReviewState {
    columns: ReviewColumn[]
    cells: Map<string, ReviewCell>
    documents: DocumentFile[]
}

const FALLBACK_COLUMNS: ReviewColumn[] = [
    { id: "parties", name: "Parties", prompt: "List all parties involved in this document with their roles. Be concise.", width: 220, order: 0 },
    { id: "effective_date", name: "Effective Date", prompt: "What is the effective date of this document? If not specified, say '—'.", width: 220, order: 1 },
    { id: "key_terms", name: "Key Terms", prompt: "What are the top 3-5 key terms in this document? Be concise.", width: 220, order: 2 },
    { id: "summary", name: "Summary", prompt: "Provide a 2-3 sentence summary of this document.", width: 220, order: 3 },
    { id: "key_obligations", name: "Key Obligations", prompt: "What are the main obligations of each party? Be concise.", width: 220, order: 4 },
]

const COLUMN_TEMPLATES: Record<string, { name: string; columns: Omit<ReviewColumn, "order">[] }> = {
    "license_review": {
        name: "License Agreement Review",
        columns: [
            { id: "parties", name: "Parties", prompt: "List all parties involved with their roles.", width: 220 },
            { id: "license_scope", name: "License Scope", prompt: "Describe the scope of the license granted (exclusive/non-exclusive, territory, field of use).", width: 220 },
            { id: "royalty_rates", name: "Royalty Rates", prompt: "What are the royalty rates and payment terms?", width: 220 },
            { id: "term_duration", name: "Term & Duration", prompt: "What is the term/duration of the agreement and renewal conditions?", width: 220 },
            { id: "ip_ownership", name: "IP Ownership", prompt: "Who owns the intellectual property? Describe IP ownership provisions.", width: 220 },
            { id: "termination", name: "Termination", prompt: "What are the termination conditions and notice requirements?", width: 220 },
        ]
    },
    "ma_due_diligence": {
        name: "M&A Due Diligence",
        columns: [
            { id: "parties", name: "Parties", prompt: "List all parties involved with their roles.", width: 220 },
            { id: "financial_obligations", name: "Financial Obligations", prompt: "What are the financial obligations and payment amounts?", width: 220 },
            { id: "representations", name: "Representations & Warranties", prompt: "Summarize key representations and warranties.", width: 220 },
            { id: "indemnification", name: "Indemnification", prompt: "Describe indemnification provisions and caps.", width: 220 },
            { id: "change_of_control", name: "Change of Control", prompt: "Are there change of control provisions? Describe them.", width: 220 },
            { id: "confidentiality", name: "Confidentiality", prompt: "Summarize confidentiality and non-disclosure obligations.", width: 220 },
        ]
    },
    "contract_comparison": {
        name: "Contract Comparison",
        columns: [
            { id: "parties", name: "Parties", prompt: "List all parties involved.", width: 220 },
            { id: "effective_date", name: "Date", prompt: "What is the effective date?", width: 220 },
            { id: "payment_terms", name: "Payment Terms", prompt: "Describe payment terms, amounts, and schedule.", width: 220 },
            { id: "liability", name: "Liability", prompt: "Describe liability limitations and caps.", width: 220 },
            { id: "governing_law", name: "Governing Law", prompt: "What is the governing law and jurisdiction?", width: 220 },
            { id: "dispute_resolution", name: "Dispute Resolution", prompt: "Describe dispute resolution mechanisms.", width: 220 },
        ]
    }
}

function getCellKey(documentId: string, columnId: string) {
    return `${documentId}__${columnId}`
}

interface TabularReviewViewProps {
    project: Project
    projectId: string
}

export function TabularReviewView({ project, projectId }: TabularReviewViewProps) {
    const [columns, setColumns] = useState<ReviewColumn[]>([])
    const [cells, setCells] = useState<Map<string, ReviewCell>>(new Map())
    const [isRunning, setIsRunning] = useState(false)
    const [chatOpen, setChatOpen] = useState(true)
    const [runProgress, setRunProgress] = useState({ total: 0, completed: 0 })
    const [isGeneratingColumns, setIsGeneratingColumns] = useState(true)

    const hasInitialized = useRef(false)
    const autoRunTriggered = useRef(false)

    const documents = useMemo(() => project.files || [], [project.files])
    const docsWithText = useMemo(() => documents.filter(d => d.extracted_text), [documents])

    // ──────────────────────────────────────────────────
    // 1. AI Column Generation on mount
    // ──────────────────────────────────────────────────
    useEffect(() => {
        if (hasInitialized.current) return
        hasInitialized.current = true

        const generateColumns = async () => {
            setIsGeneratingColumns(true)

            // Need documents with extracted text to analyze
            if (docsWithText.length === 0) {
                console.log('[Tabular Review] No documents with text, using fallback columns')
                setColumns(FALLBACK_COLUMNS)
                setIsGeneratingColumns(false)
                return
            }

            try {
                const documentSamples = docsWithText.slice(0, 5).map(doc => ({
                    name: doc.name,
                    text: doc.extracted_text?.slice(0, 2000) || ''
                }))

                const response = await fetch('/api/tabular-review/suggest-columns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, documentSamples })
                })

                if (!response.ok) throw new Error('Failed to suggest columns')

                const data = await response.json()

                if (data.columns && data.columns.length > 0) {
                    const aiColumns: ReviewColumn[] = data.columns.map(
                        (col: { name: string; prompt: string }, i: number) => ({
                            id: col.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + i,
                            name: col.name,
                            prompt: col.prompt,
                            width: 220,
                            order: i,
                        })
                    )
                    setColumns(aiColumns)
                    toast.success(`AI suggested ${aiColumns.length} columns`)
                } else {
                    throw new Error('No columns returned')
                }
            } catch (err) {
                console.error('[Tabular Review] Column suggestion failed, using fallback:', err)
                setColumns(FALLBACK_COLUMNS)
                toast.error('Using default columns (AI suggestion failed)')
            } finally {
                setIsGeneratingColumns(false)
            }
        }

        generateColumns()
    }, [docsWithText, projectId])

    // ──────────────────────────────────────────────────
    // 2. Run AI extraction for a single cell
    // ──────────────────────────────────────────────────
    const runCell = useCallback(async (docId: string, columnId: string, column: ReviewColumn, docText: string) => {
        const key = getCellKey(docId, columnId)

        setCells(prev => {
            const next = new Map(prev)
            next.set(key, { documentId: docId, columnId, content: "", status: "processing" })
            return next
        })

        try {
            const response = await fetch("/api/tabular-review/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    documentId: docId,
                    columnPrompt: column.prompt,
                    columnName: column.name,
                    documentText: docText.slice(0, 15000),
                })
            })

            if (!response.ok) throw new Error("Extraction failed")

            const data = await response.json()

            setCells(prev => {
                const next = new Map(prev)
                next.set(key, {
                    documentId: docId,
                    columnId,
                    content: data.content || "—",
                    status: "completed",
                })
                return next
            })
        } catch {
            setCells(prev => {
                const next = new Map(prev)
                next.set(key, {
                    documentId: docId,
                    columnId,
                    content: "Error extracting",
                    status: "error",
                })
                return next
            })
        }
    }, [projectId])

    // ──────────────────────────────────────────────────
    // 3. Batch extraction for a document
    // ──────────────────────────────────────────────────
    const runDocumentBatch = useCallback(async (doc: DocumentFile, targetColumns: ReviewColumn[]) => {
        if (targetColumns.length === 0) return

        setCells(prev => {
            const next = new Map(prev)
            for (const col of targetColumns) {
                next.set(getCellKey(doc.id, col.id), { documentId: doc.id, columnId: col.id, content: "", status: "processing" })
            }
            return next
        })

        try {
            const response = await fetch("/api/tabular-review/extract-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    documentId: doc.id,
                    documentText: doc.extracted_text || "",
                    columns: targetColumns.map(c => ({ id: c.id, name: c.name, prompt: c.prompt }))
                })
            })

            if (!response.ok) throw new Error("Batch extraction failed")
            const data = await response.json()

            setCells(prev => {
                const next = new Map(prev)
                for (const col of targetColumns) {
                    const content = data.results?.[col.id] || "—"
                    next.set(getCellKey(doc.id, col.id), {
                        documentId: doc.id,
                        columnId: col.id,
                        content,
                        status: "completed"
                    })
                }
                return next
            })
        } catch {
            setCells(prev => {
                const next = new Map(prev)
                for (const col of targetColumns) {
                    next.set(getCellKey(doc.id, col.id), {
                        documentId: doc.id,
                        columnId: col.id,
                        content: "Error extracting",
                        status: "error"
                    })
                }
                return next
            })
        }
    }, [projectId])

    // ──────────────────────────────────────────────────
    // 4. Run extraction for specific columns on specific docs
    // ──────────────────────────────────────────────────
    const runColumns = useCallback(async (targetColumns: ReviewColumn[], targetDocs?: DocumentFile[]) => {
        if (isRunning) return
        setIsRunning(true)

        const docs = targetDocs || docsWithText
        const totalCells = docs.length * targetColumns.length

        let initialCompleted = 0
        const docTasks: Array<{ doc: DocumentFile, cols: ReviewColumn[] }> = []

        // Group columns that need extraction by document
        for (const doc of docs) {
            const colsToRun = targetColumns.filter(col => {
                const existing = cells.get(getCellKey(doc.id, col.id))
                // Skip if already completed OR already processing to prevent duplicate API calls
                if (existing?.status === "completed" || existing?.status === "processing") {
                    if (existing?.status === "completed") initialCompleted++
                    return false
                }
                return true
            })
            if (colsToRun.length > 0) {
                docTasks.push({ doc, cols: colsToRun })
            }
        }

        setRunProgress({ total: totalCells, completed: initialCompleted })
        let currentCompleted = initialCompleted

        // Process a few documents concurrently
        const batchSize = 3
        for (let i = 0; i < docTasks.length; i += batchSize) {
            const batch = docTasks.slice(i, i + batchSize)
            await Promise.all(
                batch.map(({ doc, cols }) =>
                    runDocumentBatch(doc, cols).then(() => {
                        currentCompleted += cols.length
                        setRunProgress(prev => ({ ...prev, completed: currentCompleted }))
                    })
                )
            )
        }

        setIsRunning(false)
    }, [isRunning, docsWithText, cells, runDocumentBatch])

    // ──────────────────────────────────────────────────
    // 5. Run ALL cells (force re-run, used by Run all button)
    // ──────────────────────────────────────────────────
    const runAll = useCallback(async () => {
        if (isRunning || columns.length === 0) return
        setIsRunning(true)

        const totalCells = docsWithText.length * columns.length
        setRunProgress({ total: totalCells, completed: 0 })

        let currentCompleted = 0

        const batchSize = 3
        for (let i = 0; i < docsWithText.length; i += batchSize) {
            const batch = docsWithText.slice(i, i + batchSize)
            await Promise.all(
                batch.map((doc) =>
                    runDocumentBatch(doc, columns).then(() => {
                        currentCompleted += columns.length
                        setRunProgress(prev => ({ ...prev, completed: currentCompleted }))
                    })
                )
            )
        }

        setIsRunning(false)
        toast.success("Tabular review completed!")
    }, [isRunning, docsWithText, columns, runDocumentBatch])

    // ──────────────────────────────────────────────────
    // 5. Auto-run extraction after columns are set
    // ──────────────────────────────────────────────────
    useEffect(() => {
        if (isGeneratingColumns) return
        if (autoRunTriggered.current) return
        if (columns.length === 0 || docsWithText.length === 0) return

        autoRunTriggered.current = true
        // Small delay to ensure state is settled
        const timer = setTimeout(() => {
            runColumns(columns)
        }, 300)
        return () => clearTimeout(timer)
    }, [isGeneratingColumns, columns, docsWithText, runColumns])

    // ──────────────────────────────────────────────────
    // Add a new column (auto-triggers extraction)
    // ──────────────────────────────────────────────────
    const addColumn = useCallback((name: string, prompt?: string) => {
        const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now()
        const newCol: ReviewColumn = {
            id,
            name,
            prompt: prompt || `Extract information about "${name}" from this document. Be concise and specific.`,
            width: 220,
            order: columns.length
        }
        setColumns(prev => [...prev, newCol])

        // Auto-extract for this new column
        if (docsWithText.length > 0) {
            setTimeout(() => {
                runColumns([newCol])
            }, 100)
        }

        toast.success(`Column "${name}" added`)
    }, [columns.length, docsWithText, runColumns])

    // Remove a column
    const removeColumn = useCallback((columnId: string) => {
        setColumns(prev => prev.filter(c => c.id !== columnId))
        setCells(prev => {
            const next = new Map(prev)
            for (const key of next.keys()) {
                if (key.endsWith(`__${columnId}`)) next.delete(key)
            }
            return next
        })
    }, [])

    // Apply a template (auto-triggers extraction via the columns useEffect won't re-trigger since autoRunTriggered is true — so we trigger manually)
    const applyTemplate = useCallback((templateId: string) => {
        const template = COLUMN_TEMPLATES[templateId]
        if (!template) return
        const newColumns = template.columns.map((col, i) => ({
            ...col,
            order: i,
        }))
        setColumns(newColumns)
        setCells(new Map())

        // Auto-run for template columns
        if (docsWithText.length > 0) {
            setTimeout(() => {
                runColumns(newColumns)
            }, 100)
        }

        toast.success(`Template "${template.name}" applied`)
    }, [docsWithText, runColumns])

    // Get cell data
    const getCell = useCallback((docId: string, colId: string): ReviewCell | undefined => {
        return cells.get(getCellKey(docId, colId))
    }, [cells])

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            {/* Chat Sidebar */}
            {chatOpen && (
                <div className="w-[340px] shrink-0 border-r bg-background flex flex-col h-full">
                    <TabularReviewChat
                        projectId={projectId}
                        projectTitle={project.title}
                        columns={columns}
                        cells={cells}
                        documents={documents}
                        onClose={() => setChatOpen(false)}
                    />
                </div>
            )}

            {/* Main grid area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <TabularReviewToolbar
                    columns={columns}
                    onAddColumn={addColumn}
                    onApplyTemplate={applyTemplate}
                    onRunAll={runAll}
                    isRunning={isRunning}
                    isGeneratingColumns={isGeneratingColumns}
                    runProgress={runProgress}
                    chatOpen={chatOpen}
                    onToggleChat={() => setChatOpen(prev => !prev)}
                    templates={COLUMN_TEMPLATES}
                    documentCount={documents.length}
                />

                <TabularReviewGrid
                    documents={documents}
                    columns={columns}
                    getCell={getCell}
                    onRemoveColumn={removeColumn}
                    onRunCell={(docId, colId) => {
                        const col = columns.find(c => c.id === colId)
                        const doc = documents.find(d => d.id === docId)
                        if (col && doc?.extracted_text) {
                            runCell(docId, colId, col, doc.extracted_text)
                        }
                    }}
                />
            </div>
        </div>
    )
}
