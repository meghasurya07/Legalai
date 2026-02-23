"use client"

import { Suspense } from "react"
import { useVault } from "@/context/vault-context"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ProjectSidebar } from "@/components/vault/project-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { Project } from "@/types"

function ProjectContent() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { projects, fetchProjectWithFiles, incrementQueryCount } = useVault()

    const [project, setProject] = useState<Project | null | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)
    const hasFetched = useRef(false)

    // params.id might be string or string[]
    const projectId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

    // Initial fetch
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

    // Sync with context state when projects change (file add/remove updates context)
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
                <Button onClick={() => router.push('/vault')}>Return to Vault</Button>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="flex flex-col h-full border-r bg-background w-[300px] shrink-0">
                <div className="p-4 border-b flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/vault')} title="Back to Vault">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-medium text-sm">Back to Vault</span>
                </div>
                <ProjectSidebar project={project} />
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <ChatInterface
                    onMessageSent={() => incrementQueryCount(projectId)}
                    mode="project"
                    projectTitle={project.title}
                    projectId={projectId}
                    conversationType="vault"
                    initialConversationId={searchParams.get('chatId') || undefined}
                />
            </div>
        </div>
    )
}

export default function ProjectPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <ProjectContent />
        </Suspense>
    )
}
