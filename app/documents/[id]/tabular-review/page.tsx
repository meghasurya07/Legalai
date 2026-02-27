"use client"

import { Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { useDocuments } from "@/context/vault-context"
import { TabularReviewView } from "@/components/documents/tabular-review-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { Project } from "@/types"

function TabularReviewContent() {
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
        if (updatedProject) setProject(updatedProject)
    }, [projects, projectId])

    if (!projectId) return null

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading tabular review...</p>
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
            {/* Back nav */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/80 backdrop-blur-sm shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/documents/${projectId}`)}
                    title="Back to Project"
                    className="h-8 w-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Tabular Review</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                        {project.title}
                    </span>
                </div>
            </div>

            {/* Main content */}
            <TabularReviewView project={project} projectId={projectId} />
        </div>
    )
}

export default function TabularReviewPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <TabularReviewContent />
        </Suspense>
    )
}
