/* eslint-disable @typescript-eslint/no-unused-vars */
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
    { id: "summary", name: "Summary", prompt: "Provide a 2-3 sentence summary of this document.", width: 220, order: 0 },
    { id: "parties", name: "Parties", prompt: "List all parties involved in this document with their roles. Be concise.", width: 220, order: 1 },
    { id: "effective_date", name: "Effective Date", prompt: "What is the effective date of this document? If not specified, say '—'.", width: 220, order: 2 },
    { id: "key_terms", name: "Key Terms", prompt: "What are the top 3-5 key terms in this document? Be concise.", width: 220, order: 3 },
    { id: "key_obligations", name: "Key Obligations", prompt: "What are the main obligations of each party? Be concise.", width: 220, order: 4 },
]



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
    const [isLoadingCached, setIsLoadingCached] = useState(true)
    const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([])
    const [chatWidth, setChatWidth] = useState(340)

    const hasInitialized = useRef(false)
    const autoRunTriggered = useRef(false)
    const savedFileIds = useRef<Set<string>>(new Set())
    const pendingNewDocs = useRef<DocumentFile[]>([])
    const isDraggingRef = useRef(false)

    const documents = useMemo(() => project.files || [], [project.files])
    const docsWithText = useMemo(() => documents.filter(d => d.extracted_text), [documents])

    // ──────────────────────────────────────────────────
    // Helper: Save columns + cells to the database
    // ──────────────────────────────────────────────────
    const saveToDatabase = useCallback(async (cols: ReviewColumn[], cellMap: Map<string, ReviewCell>, msgs?: { role: "user" | "assistant"; content: string }[]) => {
        try {
            const cellArray = Array.from(cellMap.values())
            await fetch('/api/tabular-review/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    columns: cols,
                    cells: cellArray,
                    chatMessages: msgs
                })
            })
        } catch (err) {
        }
    }, [projectId])

    // ──────────────────────────────────────────────────
    // 1. Load cached data OR AI Column Generation on mount
    // ──────────────────────────────────────────────────
    useEffect(() => {
        if (hasInitialized.current) return
        hasInitialized.current = true

        const initialize = async () => {
            setIsGeneratingColumns(true)
            setIsLoadingCached(true)

            // STEP 1: Try loading from database first
            try {
                const loadRes = await fetch(`/api/tabular-review/load?projectId=${projectId}`)
                if (loadRes.ok) {
                    const cached = await loadRes.json()

                    if (cached.columns && cached.columns.length > 0) {
                        setColumns(cached.columns)

                        const restoredCells = new Map<string, ReviewCell>()
                        for (const cell of cached.cells || []) {
                            restoredCells.set(getCellKey(cell.documentId, cell.columnId), cell)
                        }
                        setCells(restoredCells)

                        if (cached.chatMessages) {
                            setChatMessages(cached.chatMessages)
                        }

                        // Track which file IDs we already have data for
                        const cachedFileIds = new Set<string>((cached.cells || []).map((c: { documentId: string }) => c.documentId))
                        savedFileIds.current = cachedFileIds

                        // Detect new documents not in cached data
                        const newDocs = docsWithText.filter(d => !cachedFileIds.has(d.id))

                        setIsGeneratingColumns(false)
                        setIsLoadingCached(false)

                        if (newDocs.length > 0) {
                            toast.success(`Loaded from cache. ${newDocs.length} new document(s) to extract.`)
                            pendingNewDocs.current = newDocs
                            // autoRunTriggered stays false so the auto-run effect picks up new docs
                        } else {
                            toast.success(`Loaded ${cached.columns.length} columns from cache`)
                            autoRunTriggered.current = true
                        }
                        return
                    }
                }
            } catch (err) {
            }

            setIsLoadingCached(false)

            // STEP 2: No cached data — generate columns with AI
            if (docsWithText.length === 0) {
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
                setColumns(FALLBACK_COLUMNS)
                toast.error('Using default columns (AI suggestion failed)')
            } finally {
                setIsGeneratingColumns(false)
            }
        }

        initialize()
    }, [docsWithText, projectId, saveToDatabase])

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

        // Auto-save after extraction completes
        setCells(currentCells => {
            setColumns(currentCols => {
                setChatMessages(currentMsgs => {
                    saveToDatabase(currentCols, currentCells, currentMsgs)
                    return currentMsgs
                })
                return currentCols
            })
            return currentCells
        })
    }, [isRunning, docsWithText, cells, runDocumentBatch, saveToDatabase])

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

        // Auto-save after full run
        setCells(currentCells => {
            setColumns(currentCols => {
                setChatMessages(currentMsgs => {
                    saveToDatabase(currentCols, currentCells, currentMsgs)
                    return currentMsgs
                })
                return currentCols
            })
            return currentCells
        })
    }, [isRunning, docsWithText, columns, runDocumentBatch, saveToDatabase])

    // ──────────────────────────────────────────────────
    // 5. Auto-run extraction after columns are set
    // ──────────────────────────────────────────────────
    useEffect(() => {
        if (isGeneratingColumns) return
        if (isLoadingCached) return
        if (autoRunTriggered.current) return
        if (columns.length === 0 || docsWithText.length === 0) return

        autoRunTriggered.current = true

        // If we have pending new docs from cached load, only run those
        const newDocs = pendingNewDocs.current
        const timer = setTimeout(() => {
            if (newDocs.length > 0) {
                pendingNewDocs.current = []
                runColumns(columns, newDocs)
            } else {
                runColumns(columns)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [isGeneratingColumns, isLoadingCached, columns, docsWithText, runColumns])

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
        setColumns(prev => {
            const nextCols = [...prev, newCol]
            // Immediately auto-save
            setCells(currentCells => {
                setChatMessages(currentMsgs => {
                    saveToDatabase(nextCols, currentCells, currentMsgs)
                    return currentMsgs
                })
                return currentCells
            })
            return nextCols
        })

        // Auto-extract for this new column
        if (docsWithText.length > 0) {
            setTimeout(() => {
                runColumns([newCol])
            }, 100)
        }

        toast.success(`Column "${name}" added`)
    }, [columns.length, docsWithText, runColumns, saveToDatabase])

    // Remove a column
    const removeColumn = useCallback((columnId: string) => {
        setColumns(prev => {
            const updated = prev.filter(c => c.id !== columnId)
            // Auto-save after column removal
            setCells(currentCells => {
                const next = new Map(currentCells)
                for (const key of next.keys()) {
                    if (key.endsWith(`__${columnId}`)) next.delete(key)
                }
                setChatMessages(currentMsgs => {
                    saveToDatabase(updated, next, currentMsgs)
                    return currentMsgs
                })
                return next
            })
            return updated
        })
    }, [saveToDatabase])



    // Get cell data
    const getCell = useCallback((docId: string, colId: string): ReviewCell | undefined => {
        return cells.get(getCellKey(docId, colId))
    }, [cells])

    // Handle saving messages from chat
    const handleSaveMessages = useCallback((newMessages: { role: "user" | "assistant"; content: string }[]) => {
        setChatMessages(newMessages)
        setCells(currentCells => {
            setColumns(currentCols => {
                saveToDatabase(currentCols, currentCells, newMessages)
                return currentCols
            })
            return currentCells
        })
    }, [saveToDatabase])

    // Handle chat resizing
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault()
        isDraggingRef.current = true

        const startX = mouseDownEvent.clientX
        const startWidth = chatWidth

        const onMouseMove = (mouseMoveEvent: MouseEvent) => {
            if (!isDraggingRef.current) return
            const newWidth = startWidth + (mouseMoveEvent.clientX - startX)
            setChatWidth(Math.min(Math.max(newWidth, 250), 800))
        }

        const onMouseUp = () => {
            isDraggingRef.current = false
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
            document.body.style.cursor = 'default'
        }

        document.body.style.cursor = 'col-resize'
        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
    }, [chatWidth])

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            {/* Chat Sidebar */}
            {chatOpen && (
                <div
                    // Edge Tools often flag inline styles dynamically injected by React, but this is required for smooth sliding
                    style={{ width: `${chatWidth}px` }}
                    className="shrink-0 border-r bg-background flex flex-col h-full relative group"
                >
                    <TabularReviewChat
                        projectId={projectId}
                        projectTitle={project.title}
                        columns={columns}
                        cells={cells}
                        documents={documents}
                        onClose={() => setChatOpen(false)}
                        initialMessages={chatMessages}
                        onSaveMessages={handleSaveMessages}
                    />

                    {/* Drag Handle */}
                    <div
                        onMouseDown={startResizing}
                        className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-primary/20 transition-colors"
                    />
                </div>
            )}

            {/* Main grid area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <TabularReviewToolbar
                    columns={columns}
                    onAddColumn={addColumn}
                    onRunAll={runAll}
                    isRunning={isRunning}
                    isGeneratingColumns={isGeneratingColumns}
                    runProgress={runProgress}
                    chatOpen={chatOpen}
                    onToggleChat={() => setChatOpen(prev => !prev)}
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
