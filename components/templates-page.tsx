"use client"

import * as React from "react"
import { FileText, Globe, Copy, FileCheck, FileSignature, Languages, FileEdit, FileWarning, Gavel, ScanSearch } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    Globe: Globe
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
                console.error('Error fetching data:', err)
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

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-12 pb-24 md:pb-32">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Templates</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Use specialized workflows to tackle complex matters</p>
                    </div>


                    {/* Workflow Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {isLoading ? (
                            // Loading skeletons
                            Array.from({ length: 9 }).map((_, i) => (
                                <Card key={i} className="group">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start gap-3">
                                            <Skeleton className="h-10 w-10 rounded-lg" />
                                            <Skeleton className="h-5 w-32" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-4 w-full mb-2" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </CardContent>
                                </Card>
                            ))
                        ) : workflows.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                                <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
                                <p className="text-muted-foreground mb-6 max-w-sm">
                                    The workflows database appears to be empty. Initialize it to get started with the default expert workflows.
                                </p>
                                <Button
                                    onClick={async () => {
                                        setIsLoading(true)
                                        try {
                                            const res = await fetch('/api/admin/seed', { method: 'POST' })
                                            if (!res.ok) throw new Error('Failed to seed')
                                            window.location.reload()
                                        } catch (error) {
                                            console.error('Seed error:', error)
                                            toast.error('Failed to initialize workflows')
                                            setIsLoading(false)
                                        }
                                    }}
                                >
                                    Initialize Templates
                                </Button>
                            </div>
                        ) : (
                            workflows.map((workflow) => {
                                const IconComponent = iconMap[workflow.icon] || FileText
                                return (
                                    <Card
                                        key={workflow.id}
                                        className="group hover:shadow-lg transition-shadow duration-200 cursor-pointer hover:border-primary/50"
                                        onClick={() => handleWorkflowClick(workflow.id)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start gap-3">
                                                <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                    <IconComponent className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <CardTitle className="text-base font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                                                        {workflow.title}
                                                    </CardTitle>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="text-sm leading-relaxed line-clamp-4">
                                                {workflow.description}
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
