"use client"

import { Suspense } from "react"
import { useDocuments } from "@/context/vault-context"
import { useParams, useRouter } from "next/navigation"
import { ProjectSidebar } from "@/components/documents/project-sidebar"
import { ChatInterface } from "@/components/chat/chat-interface"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Play } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { Project } from "@/types"

function ProjectContent() {
    const params = useParams()
    const router = useRouter()
    const { projects, fetchProjectWithFiles, incrementQueryCount } = useDocuments()

    const [project, setProject] = useState<Project | null | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)
    const hasFetched = useRef(false)

    // params.id might be string or string[]
    const projectId = Array.isArray(params.id) ? params.id[0] : (params.id as string)
    
    // Extract chatId from catch-all route e.g. /documents/[id]/chat/[chatId]
    const chatIdParam = params.chatId as string[] | undefined
    const initialChatId = chatIdParam && chatIdParam[0] === 'chat' && chatIdParam[1] ? chatIdParam[1] : undefined

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
                <Button onClick={() => router.push('/documents')}>Return to Documents</Button>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="flex flex-col h-full border-r bg-background w-[300px] shrink-0">
                <div className="p-4 border-b flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/documents')} title="Back to Documents" className="h-8 w-8 shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-medium text-sm flex-1 truncate">Back to Documents</span>
                    </div>
                    <div className="flex gap-2 w-full">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/documents/${projectId}/cross-reference`)}
                            className="flex-1 h-7 px-2 gap-1.5 text-[11px] bg-blue-600/10 border-blue-600/30 text-blue-700 hover:bg-blue-600/20 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 justify-center"
                            title="Open Cross-Reference"
                        >
                            <Play className="h-3 w-3 shrink-0" />
                            <span className="truncate">Cross-Reference</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/documents/${projectId}/tabular-review`)}
                            className="flex-1 h-7 px-2 gap-1.5 text-[11px] bg-emerald-600/10 border-emerald-600/30 text-emerald-700 hover:bg-emerald-600/20 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 justify-center"
                            title="Open Tabular Review"
                        >
                            <Play className="h-3 w-3 shrink-0" />
                            <span className="truncate">Tabular Review</span>
                        </Button>
                    </div>
                </div>
                <ProjectSidebar project={project} />
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <ChatInterface
                    onMessageSent={() => incrementQueryCount(projectId)}
                    mode="project"
                    projectTitle={project.title}
                    projectId={projectId}
                    conversationType="documents"
                    initialConversationId={initialChatId}
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
