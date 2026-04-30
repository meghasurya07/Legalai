"use client"

import * as React from "react"
import {
    Loader2, FileText, Shield, Copy, Check,
    AlertTriangle, Swords, ChevronDown, ChevronUp,
    Target
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"

// ─── Types ───────────────────────────────────────────────

interface Attack {
    persona: string
    personaIcon: string
    clauseQuoted: string
    attackTitle: string
    attack: string
    severity: 'critical' | 'high' | 'medium'
    defensiveRevision: string
    category: string
}

interface RedTeamResult {
    overallRiskScore: number
    overallSummary: string
    attacks: Attack[]
}

// ─── Persona colors ──────────────────────────────────────

const PERSONA_STYLES: Record<string, {
    border: string
    bg: string
    text: string
    badgeBg: string
}> = {
    "The Deal-Breaker": {
        border: "border-l-red-500",
        bg: "bg-red-500/5",
        text: "text-red-600 dark:text-red-400",
        badgeBg: "bg-red-500/10 text-red-700 dark:text-red-300",
    },
    "The Liability Hawk": {
        border: "border-l-orange-500",
        bg: "bg-orange-500/5",
        text: "text-orange-600 dark:text-orange-400",
        badgeBg: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    },
    "The IP Strategist": {
        border: "border-l-yellow-500",
        bg: "bg-yellow-500/5",
        text: "text-yellow-600 dark:text-yellow-400",
        badgeBg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    },
    "The Compliance Enforcer": {
        border: "border-l-blue-500",
        bg: "bg-blue-500/5",
        text: "text-blue-600 dark:text-blue-400",
        badgeBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    "The Payment Negotiator": {
        border: "border-l-purple-500",
        bg: "bg-purple-500/5",
        text: "text-purple-600 dark:text-purple-400",
        badgeBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    },
    "The Litigation Sniper": {
        border: "border-l-gray-500",
        bg: "bg-gray-500/5",
        text: "text-gray-600 dark:text-gray-400",
        badgeBg: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
    },
}

const DEFAULT_STYLE = {
    border: "border-l-gray-400",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    badgeBg: "bg-muted text-muted-foreground",
}

const SEVERITY_CONFIG: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary'; dot: string }> = {
    critical: { label: "CRITICAL", variant: "destructive", dot: "bg-red-500" },
    high: { label: "HIGH", variant: "default", dot: "bg-orange-500" },
    medium: { label: "MEDIUM", variant: "secondary", dot: "bg-yellow-500" },
}

// ─── Attack Card ─────────────────────────────────────────

function AttackCard({ attack, index }: { attack: Attack; index: number }) {
    const [isDefenseOpen, setIsDefenseOpen] = React.useState(false)
    const [copied, setCopied] = React.useState(false)
    const style = PERSONA_STYLES[attack.persona] || DEFAULT_STYLE
    const severity = SEVERITY_CONFIG[attack.severity] || SEVERITY_CONFIG.medium

    const handleCopy = async () => {
        await navigator.clipboard.writeText(attack.defensiveRevision)
        setCopied(true)
        toast.success("Defensive revision copied!")
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div
            className={`border-l-4 ${style.border} rounded-lg border bg-card overflow-hidden transition-all duration-200 hover:shadow-md`}
        >
            {/* Attack Header */}
            <div className={`px-5 py-4 ${style.bg}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-xl mt-0.5 shrink-0">{attack.personaIcon}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
                                    {attack.persona}
                                </span>
                                <Badge variant={severity.variant} className="text-[10px] px-1.5 py-0 h-4">
                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${severity.dot} mr-1`} />
                                    {severity.label}
                                </Badge>
                            </div>
                            <h3 className="text-[15px] font-semibold leading-tight">
                                #{index + 1} — {attack.attackTitle}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Attack Body */}
            <div className="px-5 py-4 space-y-4">
                {/* Targeted Clause */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Targeted Clause
                    </p>
                    <div className="rounded-md bg-muted/50 border border-border/60 px-4 py-3">
                        <p className="text-sm italic text-foreground/80 leading-relaxed">
                            &ldquo;{attack.clauseQuoted}&rdquo;
                        </p>
                    </div>
                </div>

                {/* Attack Explanation */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        <Swords className="inline h-3 w-3 mr-1 -mt-0.5" />
                        How They&apos;ll Attack
                    </p>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                        {attack.attack}
                    </p>
                </div>

                {/* Defensive Revision (Collapsible) */}
                <div>
                    <button
                        onClick={() => setIsDefenseOpen(!isDefenseOpen)}
                        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                        <Shield className="h-3 w-3" />
                        Defensive Revision
                        {isDefenseOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {isDefenseOpen && (
                        <div className="mt-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 px-4 py-3 relative group">
                            <p className="text-sm text-foreground/90 leading-relaxed pr-10">
                                {attack.defensiveRevision}
                            </p>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Risk Score Bar ──────────────────────────────────────

function RiskScoreBar({ score }: { score: number }) {
    const percentage = Math.min(Math.max(score * 10, 0), 100)
    const color = score >= 7 ? "bg-red-500" : score >= 4 ? "bg-orange-500" : "bg-emerald-500"
    const textColor = score >= 7 ? "text-red-600 dark:text-red-400" : score >= 4 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between">
                <span className={`text-3xl font-bold tabular-nums ${textColor}`}>
                    {score.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">/ 10 vulnerability score</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
                    ref={(el) => { if (el) el.style.width = `${percentage}%` }}
                />
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────

export default function RedTeam() {
    const {
        file: contractFile,
        handleFileSelect,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isRunning,
        result,
        runWithFile,
        reset,
    } = useTemplateWorkflow<RedTeamResult>({
        apiEndpoint: '/api/templates/red-team',
    })

    const handleRedTeam = async () => {
        if (!contractFile) {
            toast.error("Please upload a contract")
            return
        }

        const formData = new FormData()
        formData.append('file', contractFile)
        await runWithFile(formData, "Red Team analysis complete!")
    }

    // Count attacks by severity
    const criticalCount = result?.attacks?.filter(a => a.severity === 'critical').length || 0
    const highCount = result?.attacks?.filter(a => a.severity === 'high').length || 0
    const mediumCount = result?.attacks?.filter(a => a.severity === 'medium').length || 0

    return (
        <ToolPageLayout
            title="Red Team My Contract"
            description="6 opposing counsel personas attack your contract to find loopholes before the other side does"
            icon={<Target className="h-4 w-4" />}
            accentColor="bg-red-500/10 text-red-600 dark:text-red-400"
        >
            {!result ? (
                /* ─── Upload Section ──────────────────────────── */
                <Card className="max-w-2xl mx-auto border-dashed">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-red-500" />
                            Upload Contract
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Upload a contract and let 6 AI-powered opposing counsel personas find every weakness, loophole, and exploitable clause.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FileUploadZone id="red-team-contract" file={contractFile} onFileSelect={handleFileSelect} />
                        <Button
                            onClick={handleRedTeam}
                            disabled={!contractFile || isRunning}
                            size="lg"
                            className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deploying Opposing Counsel...
                                </>
                            ) : (
                                <>
                                    <Target className="h-4 w-4" />
                                    Red Team This Contract
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                /* ─── Results: War Room ──────────────────────── */
                <div className="space-y-6">
                    {/* Overall Risk Score */}
                    <Card className="border-red-500/30 bg-red-500/[0.02]">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </div>
                                Vulnerability Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <RiskScoreBar score={result.overallRiskScore} />
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                {result.overallSummary}
                            </p>
                            <div className="flex items-center gap-3 pt-1">
                                <Badge variant="destructive" className="gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                    {criticalCount} Critical
                                </Badge>
                                <Badge variant="default" className="gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                    {highCount} High
                                </Badge>
                                <Badge variant="secondary" className="gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                                    {mediumCount} Medium
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Attack Cards */}
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                            <Swords className="h-4 w-4" />
                            {(result.attacks || []).length} Attack{(result.attacks || []).length !== 1 ? 's' : ''} Identified
                        </h2>
                        <div className="space-y-4">
                            {(result.attacks || []).map((attack, i) => (
                                <AttackCard key={i} attack={attack} index={i} />
                            ))}
                        </div>
                    </div>

                    {/* Reset */}
                    <Button onClick={reset} variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Red Team Another Contract
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
