/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import {
    FileText, Copy, FileCheck, FileSignature, Languages,
    FileEdit, FileWarning, Gavel, ScanSearch, ArrowRight,
    Scale, Sparkles, Building2
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface Workflow {
    id: string
    title: string
    description: string
    icon: string
}

// Map icon names from database to actual components
const iconMap: Record<string, React.ElementType> = {
    FileCheck: FileCheck,
    FileText: FileText,
    Copy: Copy,
    FileSignature: FileSignature,
    Languages: Languages,
    FileEdit: FileEdit,
    FileWarning: FileWarning,
    Gavel: Gavel,
    ScanSearch: ScanSearch,
}

// Category definitions with metadata
const CATEGORIES: {
    id: string
    label: string
    description: string
    icon: React.ElementType
    accentClass: string
    iconBgClass: string
    templateIds: string[]
}[] = [
        {
            id: "analysis",
            label: "Document Analysis",
            description: "Analyze, compare, and review legal documents with AI precision",
            icon: Scale,
            accentClass: "text-blue-500",
            iconBgClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            templateIds: ["contract-analysis", "document-comparison", "redline-analysis"],
        },
        {
            id: "drafting",
            label: "Drafting & Generation",
            description: "Generate professional legal documents, memos, and client alerts",
            icon: Sparkles,
            accentClass: "text-violet-500",
            iconBgClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
            templateIds: ["draft-from-template", "legal-memo", "client-alert"],
        },
        {
            id: "research",
            label: "Research & Intelligence",
            description: "Research companies, analyze transcripts, and translate documents",
            icon: Building2,
            accentClass: "text-emerald-500",
            iconBgClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            templateIds: ["company-profile", "transcripts", "translation"],
        },
    ]

// Per-template accent colors for the icon container
const TEMPLATE_ACCENTS: Record<string, string> = {
    "contract-analysis": "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20",
    "document-comparison": "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500/20",
    "redline-analysis": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20",
    "draft-from-template": "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20",
    "legal-memo": "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20",
    "client-alert": "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 group-hover:bg-fuchsia-500/20",
    "company-profile": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20",
    "transcripts": "bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500/20",
    "translation": "bg-green-500/10 text-green-600 dark:text-green-400 group-hover:bg-green-500/20",
}

export default function WorkflowsPage() {
    const router = useRouter()
    const [workflows, setWorkflows] = React.useState<Workflow[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        async function fetchData() {
            try {
                const workflowsRes = await fetch('/api/templates/list')
                if (!workflowsRes.ok) throw new Error('Failed to fetch workflows')
                const workflowsData = await workflowsRes.json()
                setWorkflows(workflowsData)
            } catch (err) {
                setError('Failed to load workflows')
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleWorkflowClick = (workflowId: string) => {
        router.push(`/templates/${workflowId}`)
    }

    if (error) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-background items-center justify-center">
                <p className="text-destructive">{error}</p>
            </div>
        )
    }

    // Build a lookup map
    const workflowMap = new Map(workflows.map(w => [w.id, w]))

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-24 md:pb-32">
                    {/* Page Header */}
                    <div className="mb-10 md:mb-14">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="h-8 w-1 rounded-full bg-primary" />
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Templates</h1>
                        </div>
                        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                            Specialized AI-powered workflows to draft, analyze, and research legal matters with expert precision.
                        </p>
                    </div>

                    {isLoading ? (
                        /* Loading Skeleton */
                        <div className="space-y-10">
                            {[1, 2, 3].map(cat => (
                                <div key={cat}>
                                    <Skeleton className="h-5 w-40 mb-4" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="border rounded-xl p-5">
                                                <div className="flex items-start gap-3.5 mb-3">
                                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                                    <Skeleton className="h-5 w-32" />
                                                </div>
                                                <Skeleton className="h-4 w-full mb-2" />
                                                <Skeleton className="h-4 w-3/4" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : workflows.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
                                <FileWarning className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                                Initialize the templates database to get started with pre-built legal workflows.
                            </p>
                            <Button
                                onClick={async () => {
                                    setIsLoading(true)
                                    try {
                                        const res = await fetch('/api/admin/seed', { method: 'POST' })
                                        if (!res.ok) throw new Error('Failed to seed')
                                        window.location.reload()
                                    } catch (error) {
                                        toast.error('Failed to initialize workflows')
                                        setIsLoading(false)
                                    }
                                }}
                            >
                                Initialize Templates
                            </Button>
                        </div>
                    ) : (
                        /* Categorized Template Grid */
                        <div className="space-y-10 md:space-y-14">
                            {CATEGORIES.map(category => {
                                const CategoryIcon = category.icon
                                const categoryTemplates = category.templateIds.map(id => workflowMap.get(id)).filter(Boolean) as Workflow[]
                                if (categoryTemplates.length === 0) return null

                                return (
                                    <section key={category.id}>
                                        {/* Category Header */}
                                        <div className="flex items-center gap-2.5 mb-1.5">
                                            <CategoryIcon className={`h-4.5 w-4.5 ${category.accentClass}`} />
                                            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                                                {category.label}
                                            </h2>
                                        </div>
                                        <p className="text-xs text-muted-foreground/70 mb-4 ml-7">
                                            {category.description}
                                        </p>

                                        {/* Template Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                            {categoryTemplates.map(workflow => {
                                                const IconComponent = iconMap[workflow.icon] || FileText
                                                const accent = TEMPLATE_ACCENTS[workflow.id] || "bg-muted text-muted-foreground"

                                                return (
                                                    <button
                                                        key={workflow.id}
                                                        className="group relative text-left rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-border hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                        onClick={() => handleWorkflowClick(workflow.id)}
                                                    >
                                                        {/* Icon + Title */}
                                                        <div className="flex items-start gap-3.5 mb-3">
                                                            <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${accent}`}>
                                                                <IconComponent className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0 pt-0.5">
                                                                <h3 className="text-[15px] font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                                                    {workflow.title}
                                                                </h3>
                                                            </div>
                                                        </div>

                                                        {/* Description */}
                                                        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-3 mb-3">
                                                            {workflow.description}
                                                        </p>

                                                        {/* Hover Arrow */}
                                                        <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                            <span>Open</span>
                                                            <ArrowRight className="h-3 w-3" />
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </section>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
