"use client"

import * as React from "react"
import {
    FileText, Copy, FileCheck, Languages,
    FileEdit, FileWarning, ScanSearch, ArrowRight,
    Search, Target
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
    Languages: Languages,
    FileEdit: FileEdit,
    ScanSearch: ScanSearch,
    Target: Target,
}

// Only show these 5 templates
const ALLOWED_TEMPLATES = new Set([
    "red-team",
    "contract-analysis",
    "document-comparison",
    "redline-analysis",
    "company-profile",
    "translation",
])

// Per-template accent colors for the icon container
const TEMPLATE_ACCENTS: Record<string, string> = {
    "red-team": "bg-red-500/10 text-red-600 dark:text-red-400 group-hover:bg-red-500/20",
    "contract-analysis": "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20",
    "document-comparison": "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500/20",
    "redline-analysis": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20",
    "company-profile": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20",
    "translation": "bg-green-500/10 text-green-600 dark:text-green-400 group-hover:bg-green-500/20",
}

export default function WorkflowsPage() {
    const router = useRouter()
    const [workflows, setWorkflows] = React.useState<Workflow[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [searchQuery, setSearchQuery] = React.useState("")

    React.useEffect(() => {
        async function fetchData() {
            try {
                const workflowsRes = await fetch('/api/templates/list')
                if (!workflowsRes.ok) throw new Error('Failed to fetch workflows')
                const workflowsData = await workflowsRes.json()
                setWorkflows(workflowsData)
            } catch {
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

    // Filter to allowed templates and apply search
    const filteredWorkflows = workflows
        .filter(w => ALLOWED_TEMPLATES.has(w.id))
        .filter(w => {
            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase()
            return w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
        })

    if (error) {
        return (
            <div className="flex flex-col flex-1 min-h-0 bg-background items-center justify-center">
                <p className="text-destructive">{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-24 md:pb-32">
                    {/* Page Header */}
                    <div className="mb-8 md:mb-10">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="h-8 w-1 rounded-full bg-primary" />
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Templates</h1>
                        </div>
                        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                            Specialized AI-powered workflows to draft, analyze, and research legal matters with expert precision.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-8">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full max-w-md h-10 pl-10 pr-4 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-shadow"
                        />
                    </div>

                    {isLoading ? (
                        /* Loading Skeleton */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5].map(i => (
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
                    ) : workflows.filter(w => ALLOWED_TEMPLATES.has(w.id)).length === 0 ? (
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
                                    } catch {
                                        toast.error('Failed to initialize workflows')
                                        setIsLoading(false)
                                    }
                                }}
                            >
                                Initialize Templates
                            </Button>
                        </div>
                    ) : filteredWorkflows.length === 0 ? (
                        /* No Search Results */
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                <Search className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-base font-semibold mb-1">No templates match &ldquo;{searchQuery}&rdquo;</h3>
                            <p className="text-sm text-muted-foreground">Try a different search term</p>
                        </div>
                    ) : (
                        /* Flat Template Grid */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {filteredWorkflows.map(workflow => {
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
                    )}
                </div>
            </div>
        </div>
    )
}
