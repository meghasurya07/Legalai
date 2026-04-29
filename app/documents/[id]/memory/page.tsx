"use client"

import { Suspense } from "react"
import { useDocuments } from "@/context/vault-context"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Brain } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { Project } from "@/types"
import MemoryPanel from "@/components/sidebar-panels/memory-panel"
import { Separator } from "@/components/ui/separator"

function MemoryContent() {
    const params = useParams()
    const router = useRouter()
    const { projects, fetchProjectWithFiles } = useDocuments()

    const [project, setProject] = useState<Project | null | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)
    const hasFetched = useRef(false)

    const projectId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

    useEffect(() => {
        if (!projectId || hasFetched.current) return
        hasFetched.current = true

        const loadProject = async () => {
            setIsLoading(true)
            const fetchedProject = await fetchProjectWithFiles(projectId)
            setProject(fetchedProject)
            setIsLoading(false)
        }

        loadProject()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    useEffect(() => {
        if (!projectId) return
        const updatedProject = projects.find(p => p.id === projectId)
        if (updatedProject) {
            setProject(updatedProject)
        }
    }, [projects, projectId])

    if (!projectId) return null

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading project...</p>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <h2 className="text-xl font-semibold">Project not found</h2>
                <Button onClick={() => router.push('/documents')}>Return to Documents</Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-3 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => router.push(`/documents/${projectId}`)} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                        <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Project Memory</h1>
                        <p className="text-xs text-muted-foreground">{project.title}</p>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Memory Panel */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    <MemoryPanel projectId={projectId} />
                </div>
            </div>
        </div>
    )
}

export default function MemoryPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <MemoryContent />
        </Suspense>
    )
}
