"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    X, Loader2, AlertTriangle, Plus, Minus, ArrowLeftRight,
    ChevronDown, ChevronUp, ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

interface RedlineChange {
    type: 'insertion' | 'deletion' | 'modification'
    original: string
    revised: string
    section: string
    severity: 'high' | 'medium' | 'low'
    explanation: string
}

interface RedlineResult {
    summary: string
    totalChanges: number
    riskLevel: 'high' | 'medium' | 'low'
    changes: RedlineChange[]
    recommendations: string[]
}

interface RedlinePanelProps {
    isOpen: boolean
    onClose: () => void
    draftText: string
}

const SEVERITY_STYLES = {
    high: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50',
    medium: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50',
    low: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50',
}

const TYPE_ICONS = {
    insertion: <Plus className="h-3.5 w-3.5 text-green-600" />,
    deletion: <Minus className="h-3.5 w-3.5 text-red-600" />,
    modification: <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600" />,
}

export function RedlinePanel({ isOpen, onClose, draftText }: RedlinePanelProps) {
    const [counterpartyText, setCounterpartyText] = useState('')
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [result, setResult] = useState<RedlineResult | null>(null)
    const [expandedChange, setExpandedChange] = useState<number | null>(null)

    const handleAnalyze = async () => {
        if (!counterpartyText.trim()) {
            toast.error('Please paste the counterparty document text')
            return
        }

        setIsAnalyzing(true)
        try {
            const res = await fetch('/api/drafts/redline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    draftText,
                    counterpartyText: counterpartyText.trim(),
                }),
            })

            if (!res.ok) throw new Error('Failed to analyze')
            const data = await res.json()
            setResult(data)
        } catch {
            toast.error('Failed to generate redline comparison')
        } finally {
            setIsAnalyzing(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="w-[400px] border-l bg-card flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    <h3 className="text-sm font-semibold">Smart Redline</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!result ? (
                    <>
                        <p className="text-xs text-muted-foreground">
                            Paste the counterparty&apos;s version below. Wesley will identify all changes, assess risk, and provide recommendations.
                        </p>
                        <Textarea
                            placeholder="Paste the counterparty document text here..."
                            value={counterpartyText}
                            onChange={(e) => setCounterpartyText(e.target.value)}
                            className="min-h-[200px] text-xs"
                        />
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !counterpartyText.trim()}
                            className="w-full gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white"
                        >
                            {isAnalyzing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ShieldAlert className="h-4 w-4" />
                            )}
                            Analyze Changes
                        </Button>
                    </>
                ) : (
                    <>
                        {/* Summary */}
                        <div className={`rounded-lg border p-3 ${SEVERITY_STYLES[result.riskLevel]}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">{result.riskLevel} Risk</span>
                                <span className="text-xs ml-auto">{result.totalChanges} changes</span>
                            </div>
                            <p className="text-xs mt-1">{result.summary}</p>
                        </div>

                        {/* Changes */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Changes</h4>
                            {result.changes.map((change, idx) => (
                                <div
                                    key={idx}
                                    className="border rounded-lg overflow-hidden bg-background"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpandedChange(expandedChange === idx ? null : idx)}
                                        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors"
                                    >
                                        {TYPE_ICONS[change.type]}
                                        <span className="text-xs flex-1 truncate">{change.section}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_STYLES[change.severity]}`}>
                                            {change.severity}
                                        </span>
                                        {expandedChange === idx ? (
                                            <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        )}
                                    </button>

                                    {expandedChange === idx && (
                                        <div className="border-t p-2.5 space-y-2 bg-muted/10">
                                            {change.original && (
                                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded px-2 py-1.5">
                                                    <span className="text-[10px] font-bold text-red-600 uppercase">Original</span>
                                                    <p className="text-xs mt-0.5 text-red-800 dark:text-red-200 line-through">{change.original}</p>
                                                </div>
                                            )}
                                            {change.revised && (
                                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded px-2 py-1.5">
                                                    <span className="text-[10px] font-bold text-green-600 uppercase">Revised</span>
                                                    <p className="text-xs mt-0.5 text-green-800 dark:text-green-200">{change.revised}</p>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground italic">{change.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Recommendations */}
                        {result.recommendations && result.recommendations.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommendations</h4>
                                <div className="space-y-1.5">
                                    {result.recommendations.map((rec, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2.5">
                                            <span className="text-primary font-bold shrink-0">{idx + 1}.</span>
                                            <span>{rec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reset button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => { setResult(null); setCounterpartyText('') }}
                        >
                            Compare Another Document
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
