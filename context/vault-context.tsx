"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { toast } from "sonner"
import { Project, DocumentFile } from "@/types"

interface DocumentsContextType {
    projects: Project[]
    isLoading: boolean
    error: string | null
    refreshProjects: () => Promise<void>
    addProject: (title: string) => Promise<void>
    renameProject: (id: string, newTitle: string) => Promise<void>
    deleteProject: (id: string) => Promise<void>
    addFileToProject: (projectId: string, file: File) => Promise<void>
    removeFileFromProject: (projectId: string, fileId: string) => Promise<void>
    incrementQueryCount: (projectId: string) => Promise<void>
    decrementQueryCount: (projectId: string) => void
    getProject: (id: string) => Project | undefined
    fetchProjectWithFiles: (id: string) => Promise<Project | null>
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined)

export function DocumentsProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refreshProjects = useCallback(async () => {
        try {
            setError(null)
            const response = await fetch('/api/documents/projects', { cache: 'no-store' })
            if (!response.ok) {
                throw new Error('Failed to fetch projects')
            }
            const data = await response.json()
            setProjects(data)
        } catch (err) {
            console.error('Error fetching projects:', err)
            setError('Failed to load projects')
            toast.error('Failed to load projects')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshProjects()
    }, [refreshProjects])

    const addProject = async (title: string) => {
        try {
            const response = await fetch('/api/documents/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            })

            if (!response.ok) {
                throw new Error('Failed to create project')
            }

            const newProject = await response.json()
            setProjects(prev => [newProject, ...prev])
            toast.success(`Project "${title}" created`)

            // Add to history
            await fetch('/api/recent-chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Project: ${title}`,
                    subtitle: 'Documents Project • 0 Files',
                    type: 'documents',
                    preview: `Created new documents project "${title}"`,
                    meta: { projectId: newProject.id, fileCount: 0 }
                })
            })
        } catch (err) {
            console.error('Error creating project:', err)
            toast.error('Failed to create project')
        }
    }

    const renameProject = async (id: string, newTitle: string) => {
        try {
            const response = await fetch(`/api/documents/projects/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            })

            if (!response.ok) {
                throw new Error('Failed to rename project')
            }

            setProjects(prev => prev.map(p =>
                p.id === id ? { ...p, title: newTitle } : p
            ))
            toast.success(`Renamed to "${newTitle}"`)
        } catch (err) {
            console.error('Error renaming project:', err)
            toast.error('Failed to rename project')
        }
    }

    const deleteProject = async (id: string) => {
        const project = projects.find(p => p.id === id)
        try {
            const response = await fetch(`/api/documents/projects/${id}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('Failed to delete project')
            }

            setProjects(prev => prev.filter(p => p.id !== id))
            if (project) {
                toast.success(`Deleted "${project.title}"`)
            }
        } catch (err) {
            console.error('Error deleting project:', err)
            toast.error('Failed to delete project')
        }
    }

    const addFileToProject = async (projectId: string, file: File) => {
        // Optimistic update (show processing state)
        const tempId = Math.random().toString(36).substring(7)
        const tempFile: DocumentFile = {
            id: tempId,
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type,
            uploadedAt: new Date().toISOString(),
            url: '',
            isUploading: true
        }

        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    files: [tempFile, ...p.files],
                    fileCount: p.fileCount + 1
                }
            }
            return p
        }))

        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch(`/api/documents/projects/${projectId}/files`, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to upload file')
            }

            const newFile = await response.json()

            // confirm update
            setProjects(prev => prev.map(p => {
                if (p.id === projectId) {
                    return {
                        ...p,
                        files: p.files.map(f => f.id === tempId ? { ...newFile, uploadedAt: new Date(newFile.uploadedAt) } : f)
                    }
                }
                return p
            }))

            toast.success("File uploaded successfully")
        } catch (err) {
            console.error('Error adding file:', err)
            toast.error(err instanceof Error ? err.message : 'Failed to upload file')

            // Revert optimistic update
            setProjects(prev => prev.map(p => {
                if (p.id === projectId) {
                    return {
                        ...p,
                        files: p.files.filter(f => f.id !== tempId),
                        fileCount: Math.max(0, p.fileCount - 1)
                    }
                }
                return p
            }))
        }
    }

    const removeFileFromProject = async (projectId: string, fileId: string) => {
        // Optimistic update: set isDeleting
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    files: p.files.map(f => f.id === fileId ? { ...f, isDeleting: true } : f)
                }
            }
            return p
        }))

        try {
            const response = await fetch(`/api/documents/projects/${projectId}/files/${fileId}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('Failed to remove file')
            }

            setProjects(prev => prev.map(p => {
                if (p.id === projectId) {
                    return {
                        ...p,
                        files: p.files.filter(f => f.id !== fileId),
                        fileCount: Math.max(0, p.fileCount - 1)
                    }
                }
                return p
            }))
            toast.success("File removed from project")
        } catch (err) {
            console.error('Error removing file:', err)
            toast.error('Failed to remove file')

            // Revert optimistic update (remove isDeleting flag)
            setProjects(prev => prev.map(p => {
                if (p.id === projectId) {
                    return {
                        ...p,
                        files: p.files.map(f => f.id === fileId ? { ...f, isDeleting: false } : f)
                    }
                }
                return p
            }))
        }
    }

    const incrementQueryCount = async (projectId: string) => {
        try {
            await fetch(`/api/documents/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incrementQueryCount: true })
            })

            setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, queryCount: (p.queryCount || 0) + 1 } : p
            ))
        } catch (err) {
            console.error('Error incrementing query count:', err)
        }
    }

    const decrementQueryCount = useCallback((projectId: string) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, queryCount: Math.max(0, (p.queryCount || 0) - 1) } : p
        ))
    }, [])

    const getProject = (id: string) => projects.find(p => p.id === id)

    const fetchProjectWithFiles = async (id: string): Promise<Project | null> => {
        try {
            const response = await fetch(`/api/documents/projects/${id}`, { cache: 'no-store' })
            if (!response.ok) {
                return null
            }
            const data = await response.json()
            // Transform files to include proper Date objects
            const project: Project = {
                ...data,
                files: (data.files || []).map((f: DocumentFile) => ({
                    ...f,
                    uploadedAt: new Date(f.uploadedAt)
                }))
            }
            // Update local state so getProject also has the files
            setProjects(prev => prev.map(p =>
                p.id === id ? project : p
            ))
            return project
        } catch (err) {
            console.error('Error fetching project with files:', err)
            return null
        }
    }

    return (
        <DocumentsContext.Provider value={{
            projects,
            isLoading,
            error,
            refreshProjects,
            addProject,
            renameProject,
            deleteProject,
            addFileToProject,
            removeFileFromProject,
            incrementQueryCount,
            decrementQueryCount,
            getProject,
            fetchProjectWithFiles
        }}>
            {children}
        </DocumentsContext.Provider>
    )
}

export function useDocuments() {
    const context = useContext(DocumentsContext)
    if (context === undefined) {
        throw new Error("useDocuments must be used within a DocumentsProvider")
    }
    return context
}
