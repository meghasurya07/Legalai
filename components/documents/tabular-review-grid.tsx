"use client"

import { DocumentFile } from "@/types"
import { ReviewColumn, ReviewCell } from "./tabular-review-view"
import { Loader2, AlertCircle, X, FileText } from "lucide-react"
import { useState } from "react"

interface TabularReviewGridProps {
    documents: DocumentFile[]
    columns: ReviewColumn[]
    getCell: (docId: string, colId: string) => ReviewCell | undefined
    onRemoveColumn: (colId: string) => void
    onRunCell: (docId: string, colId: string) => void
}

function CellContent({ cell, onRun }: { cell?: ReviewCell; onRun: () => void }) {
    const [expanded, setExpanded] = useState(false)

    if (!cell || cell.status === "pending") {
        return (
            <button
                onClick={onRun}
                className="w-full h-[36px] flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                title="Click to extract"
            >
                <span className="text-[13px]">—</span>
            </button>
        )
    }

    if (cell.status === "processing") {
        return (
            <div className="flex items-center justify-center h-[36px]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
            </div>
        )
    }

    if (cell.status === "error") {
        return (
            <div className="flex items-center gap-1 px-3 h-[36px] text-red-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="text-[13px]">Error</span>
            </div>
        )
    }

    if (!cell.content || cell.content === "—" || cell.content.toLowerCase().includes("not found in document")) {
        return <div className="px-3 h-[36px] flex items-center text-[13px] text-neutral-800 dark:text-neutral-200">—</div>
    }

    // Helper to determine if a value should render as a categorical pill tag (strictly for categories like Exclusivity)
    const isTagList = (() => {
        const items = cell.content.split(/[,;]/).map(t => t.trim()).filter(Boolean)
        if (items.length === 0 || items.length > 3) return false

        // Strictly only allow these specific categorical terms to be tags
        // This prevents entity names like "TCMG-MA, LLC" from being turned into tags
        const knownCategories = [
            'exclusive', 'non-exclusive', 'other', 'yes', 'no',
            'active', 'inactive', 'pending', 'approved', 'rejected',
            'true', 'false', 'none', 'n/a', 'high', 'medium', 'low',
            'governing', 'fixed', 'variable'
        ]

        return items.every(item => knownCategories.includes(item.toLowerCase()))
    })()

    // Helper for tag colors
    const getTagColor = (text: string) => {
        const lower = text.toLowerCase()
        if (lower === 'exclusive') return 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
        if (lower === 'non-exclusive') return 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
        if (lower === 'other') return 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
        if (lower === 'yes' || lower === 'approved' || lower === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'

        // Hash for consistant colors
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const colors = [
            'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
            'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
            'bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
            'bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20'
        ]
        return colors[hash % colors.length]
    }

    if (isTagList) {
        const tags = cell.content.split(/[,;]/).map(t => t.trim()).filter(Boolean)
        return (
            <div
                className={`px-3 py-1 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors h-full flex flex-wrap items-center gap-1.5 min-h-[36px] overflow-auto`}
                title={cell.content}
            >
                {tags.map((tag, i) => (
                    <span
                        key={i}
                        className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-medium leading-tight whitespace-nowrap shadow-sm ${getTagColor(tag)}`}
                    >
                        {tag}
                    </span>
                ))}
            </div>
        )
    }

    return (
        <div
            className={`px-3 text-[13px] text-neutral-800 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors ${expanded ? 'py-2 whitespace-pre-wrap break-words' : 'h-[36px] flex items-center overflow-hidden'}`}
            onClick={() => setExpanded(!expanded)}
            title={expanded ? undefined : cell.content}
        >
            <span className={expanded ? '' : 'truncate'}>
                {cell.content}
            </span>
        </div>
    )
}

export function TabularReviewGrid({
    documents,
    columns,
    getCell,
    onRemoveColumn,
    onRunCell,
}: TabularReviewGridProps) {
    if (documents.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
                <FileText className="h-12 w-12 opacity-20" />
                <div className="text-center">
                    <p className="text-sm font-medium">No documents in this project</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">Upload documents to your project first, then start the tabular review.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse table-fixed">
                <colgroup>
                    {/* Row number */}
                    <col className="w-[36px]" />
                    {/* Document name */}
                    <col className="w-[170px]" />
                    {/* Dynamic columns — equal width, filling remaining space */}
                    {columns.map(col => (
                        <col key={col.id} className="w-[220px]" />
                    ))}
                </colgroup>
                <thead className="sticky top-0 z-10">
                    <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
                        {/* Row number */}
                        <th className="px-2 py-[8px] text-center text-[13px] font-normal text-neutral-400 sticky left-0 bg-neutral-50 dark:bg-neutral-900 z-20 border-r border-neutral-200 dark:border-neutral-700">
                        </th>
                        {/* Document name — sticky */}
                        <th className="px-3 py-[8px] text-left text-[13px] font-medium text-neutral-600 dark:text-neutral-300 sticky left-[36px] bg-neutral-50 dark:bg-neutral-900 z-20 border-r border-neutral-200 dark:border-neutral-700">
                            <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                                <span>Document</span>
                            </div>
                        </th>
                        {/* Dynamic columns */}
                        {columns.map(col => (
                            <th
                                key={col.id}
                                className="px-3 py-[8px] text-left text-[13px] font-medium text-neutral-600 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 last:border-r-0 group"
                            >
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <FileText className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                                    <span className="truncate">{col.name}</span>
                                    <button
                                        onClick={() => onRemoveColumn(col.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 shrink-0 ml-auto"
                                        title="Remove column"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {documents.map((doc, rowIndex) => (
                        <tr
                            key={doc.id}
                            className="border-b border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/20 transition-colors"
                        >
                            {/* Row number */}
                            <td className="px-2 text-center text-[13px] text-neutral-400 font-normal sticky left-0 bg-white dark:bg-neutral-950 z-10 border-r border-neutral-100 dark:border-neutral-800/60 h-[36px]">
                                {rowIndex + 1}
                            </td>
                            {/* Document name */}
                            <td className="px-3 sticky left-[36px] bg-white dark:bg-neutral-950 z-10 border-r border-neutral-100 dark:border-neutral-800/60 h-[36px]">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <FileText className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                                    <span className="text-[13px] text-neutral-800 dark:text-neutral-200 truncate" title={doc.name}>
                                        {doc.name.replace(/\.[^.]+$/, '')}
                                    </span>
                                </div>
                            </td>
                            {/* Data cells */}
                            {columns.map(col => (
                                <td
                                    key={col.id}
                                    className="border-r border-neutral-100 dark:border-neutral-800/60 last:border-r-0 p-0 overflow-hidden"
                                >
                                    <CellContent
                                        cell={getCell(doc.id, col.id)}
                                        onRun={() => onRunCell(doc.id, col.id)}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
