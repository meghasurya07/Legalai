"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
// import { ScrollArea } from "@/components/ui/scroll-area" 
import { Upload, Trash2, Search, Loader2, FileText, Table } from "lucide-react"
import { FileIcon } from "@/components/ui/file-icon"
import { FilePreviewContent } from "@/components/ui/file-preview-content"
import { useDocuments } from "@/context/vault-context"
import { Project, Attachment } from "@/types"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"

interface ProjectSidebarProps {
    project: Project
}

export function ProjectSidebar({ project }: ProjectSidebarProps) {
    const { addFileToProject, removeFileFromProject } = useDocuments()
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [previewFile, setPreviewFile] = useState<{ id: string, name: string, size: string, type: string, url?: string, extracted_text?: string | null } | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)

    // Real file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files) {
            const incomingFiles = Array.from(files)
            const duplicates = incomingFiles.filter(f => project.files.some(existing => existing.name === f.name))

            if (duplicates.length > 0) {
                setIsDuplicateModalOpen(true)
            }

            const uniqueFiles = incomingFiles.filter(f => !project.files.some(existing => existing.name === f.name))

            if (uniqueFiles.length === 0) {
                setIsUploadOpen(false)
                return
            }

            uniqueFiles.forEach(file => {
                addFileToProject(project.id, file)
            })
            setIsUploadOpen(false)
        }
    }

    const [searchQuery, setSearchQuery] = useState("")

    const filteredFiles = project.files.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="w-[300px] border-r flex flex-col h-full bg-muted/10 shrink-0" id="project-sidebar">
            <div className="p-4 flex flex-col gap-4 shrink-0">
                <div>
                    <h3 className="font-semibold text-lg truncate" title={project.title}>{project.title}</h3>
                    <p className="text-xs text-muted-foreground">{project.organization}</p>
                </div>

                <Button className="w-full gap-2" onClick={() => setIsUploadOpen(true)} id="project-upload-btn">
                    <Upload className="h-4 w-4" />
                    Upload Files
                </Button>

                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search files..."
                        className="pl-8 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Separator className="shrink-0" />

            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 pt-4 pb-6">
                    <h4 className="text-xs font-semibold text-muted-foreground px-2 mb-2">DATABASE ({filteredFiles.length})</h4>
                    <div className="flex flex-col gap-1 px-1" id="project-files-list">
                        {filteredFiles.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-8 px-4 border border-dashed rounded-md mx-2">
                                <p>No files yet.</p>
                                <p className="text-xs mt-1">Upload documents to start analyzing.</p>
                            </div>
                        ) : (
                            filteredFiles.map(file => (
                                <div
                                    key={file.id}
                                    className={`flex items-center justify-between group px-2 py-2 rounded-md hover:bg-accent cursor-pointer text-sm ${file.isUploading ? 'opacity-70' : ''}`}
                                    onClick={() => !file.isUploading && setPreviewFile(file)}
                                >
                                    <div className="flex items-center gap-2 truncate flex-1">
                                        {file.isUploading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                                        ) : (
                                            <FileIcon filename={file.name} className="h-4 w-4 shrink-0" />
                                        )}
                                        <span className="truncate">{file.name}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={file.isDeleting || file.isUploading}
                                        className={`h-6 w-6 ${file.isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity text-muted-foreground hover:text-destructive`}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            removeFileFromProject(project.id, file.id)
                                        }}
                                    >
                                        {file.isDeleting ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3 w-3" />
                                        )}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Files</DialogTitle>
                        <DialogDescription>Add documents to your project database.</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-muted/50 dark:hover:bg-muted">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-2 text-gray-500" />
                                <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            </div>
                            <input id="dropzone-file" type="file" className="hidden" multiple onChange={handleFileUpload} />
                        </label>
                    </div>
                </DialogContent>
            </Dialog>

            {/* File Preview Dialog */}
            <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
                <DialogContent className="max-w-full sm:max-w-4xl w-[95vw] sm:w-full h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
                    <DialogHeader className="p-3 sm:p-4 border-b bg-muted/20">
                        <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                            {(() => {
                                const type = (previewFile?.type?.toLowerCase().includes('pdf') ? 'pdf' :
                                    previewFile?.type?.toLowerCase().includes('image') ? 'image' :
                                        previewFile?.type?.toLowerCase().includes('word') || previewFile?.name.endsWith('.docx') ? 'docx' :
                                            previewFile?.type?.toLowerCase().includes('csv') || previewFile?.name.endsWith('.csv') ? 'csv' :
                                                previewFile?.type?.toLowerCase().includes('text') || previewFile?.name.endsWith('.txt') ? 'text' :
                                                    'other') as Attachment['type']

                                return type === 'docx' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" /> :
                                    type === 'csv' ? <Table className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" /> :
                                        type === 'pdf' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" /> :
                                            type === 'image' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" /> :
                                                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                            })()}
                            <span className="truncate">{previewFile?.name}</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 bg-muted/10 relative overflow-auto">
                        {previewFile ? (
                            <FilePreviewContent
                                attachment={{
                                    name: previewFile.name,
                                    url: previewFile.url,
                                    type: (previewFile.type?.toLowerCase().includes('pdf') ? 'pdf' :
                                        previewFile.type?.toLowerCase().includes('image') ? 'image' :
                                            previewFile.type?.toLowerCase().includes('word') || previewFile.name.endsWith('.docx') ? 'docx' :
                                                previewFile.type?.toLowerCase().includes('csv') || previewFile.name.endsWith('.csv') ? 'csv' :
                                                    previewFile.type?.toLowerCase().includes('text') || previewFile.name.endsWith('.txt') ? 'text' :
                                                        'other') as Attachment['type'],
                                    source: 'upload',
                                    extractedText: previewFile.extracted_text
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8">
                                <FileIcon filename="" className="h-16 w-16 mb-4 opacity-20" />
                                <p>Preview not available.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </div>
    )
}
