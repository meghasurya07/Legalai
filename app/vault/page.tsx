"use client"

import { useState } from "react"
import { VaultHeader } from "@/components/vault/vault-header"
import { CreateProjectCard } from "@/components/vault/create-project-card"
import { ProjectCard } from "@/components/vault/project-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useVault } from "@/context/vault-context"
import { Project } from "@/types"
import { useRouter } from "next/navigation"

export default function VaultPage() {
    const { projects, addProject, renameProject, deleteProject } = useVault()
    const router = useRouter()

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [currentProject, setCurrentProject] = useState<Project | null>(null)
    const [projectNameInput, setProjectNameInput] = useState("")

    const handleCreateProject = () => {
        if (!projectNameInput.trim()) return
        addProject(projectNameInput)
        setIsCreateOpen(false)
        setProjectNameInput("")
    }

    const openRenameDialog = (id: string, currentTitle: string) => {
        const project = projects.find(p => p.id === id)
        if (project) {
            setCurrentProject(project)
            setProjectNameInput(currentTitle)
            setIsRenameOpen(true)
        }
    }

    const handleRenameProject = () => {
        if (!currentProject || !projectNameInput.trim()) return

        renameProject(currentProject.id, projectNameInput)

        setIsRenameOpen(false)
        setCurrentProject(null)
        setProjectNameInput("")
    }

    const openDeleteDialog = (id: string) => {
        const project = projects.find(p => p.id === id)
        if (project) {
            setCurrentProject(project)
            setIsDeleteOpen(true)
        }
    }

    const handleDeleteProject = () => {
        if (!currentProject) return

        deleteProject(currentProject.id)
        setIsDeleteOpen(false)
        setCurrentProject(null)
    }

    const handleProjectClick = (projectId: string) => {
        router.push(`/vault/${projectId}`)
    }

    return (
        <div className="flex flex-col flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6 space-y-6 md:space-y-8 h-full overflow-y-auto">
            <VaultHeader />

            <div className="space-y-3 md:space-y-4">
                <h2 className="text-base sm:text-lg font-medium">Your projects</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4" id="project-grid">
                    <CreateProjectCard onClick={() => {
                        setProjectNameInput("")
                        setIsCreateOpen(true)
                    }} />

                    {projects.map((project) => (
                        <div key={project.id} onClick={() => handleProjectClick(project.id)}>
                            <ProjectCard
                                id={project.id}
                                title={project.title}
                                organization={project.organization}
                                fileCount={project.fileCount}
                                queryCount={project.queryCount}
                                icon={project.icon}
                                isSecured={project.isSecured}
                                onRename={openRenameDialog}
                                onDelete={(id) => {
                                    // Prevent navigation when clicking delete
                                    openDeleteDialog(id)
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Project Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Project</DialogTitle>
                        <DialogDescription>Enter a name for your new project.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label htmlFor="create-name" className="mb-2 block text-sm font-medium">Project Name</label>
                        <Input
                            id="create-name"
                            value={projectNameInput}
                            onChange={(e) => setProjectNameInput(e.target.value)}
                            placeholder="e.g., Merger Analysis 2024"
                            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateProject} disabled={!projectNameInput.trim()}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename Project Dialog */}
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Project</DialogTitle>
                        <DialogDescription>Enter a new name for this project.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label htmlFor="rename-name" className="mb-2 block text-sm font-medium">Project Name</label>
                        <Input
                            id="rename-name"
                            value={projectNameInput}
                            onChange={(e) => setProjectNameInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRenameProject()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                        <Button onClick={handleRenameProject} disabled={!projectNameInput.trim()}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-semibold text-foreground">“{currentProject?.title}”</span>?
                            This action cannot be undone and all associated files will be removed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteProject}>Delete Project</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
