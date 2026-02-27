export interface Project {
    id: string
    title: string
    organization: string
    fileCount: number
    queryCount: number
    isSecured: boolean
    icon: "book" | "folder"
    files: DocumentFile[]
}

export interface DocumentFile {
    id: string
    name: string
    size: string
    type: string
    url: string
    uploadedAt: string // API returns string, but frontend might parse to Date. Let's keep string for API types.
    status?: string
    isUploading?: boolean
    isDeleting?: boolean
    extracted_text?: string | null
    analysis?: DocumentAnalysis | null
    clauses?: DocumentClause[]
}

export interface DocumentAnalysis {
    id: string
    file_id: string
    project_id: string
    summary: string
    parties: { name: string; role: string }[]
    effective_date: string | null
    termination_clause: string | null
    governing_law: string | null
    key_obligations: { party: string; obligation: string; deadline?: string }[]
    risks: { category: string; description: string; severity: 'high' | 'medium' | 'low' }[]
    created_at: string
}

export interface DocumentClause {
    id: string
    file_id: string
    project_id: string
    clause_type: string
    section_title: string | null
    section_number: string | null
    content: string
    chunk_ref: string | null
    created_at: string
}

export interface Conversation {
    id: string
    title: string
    created_at: string
    updated_at?: string
    project_id?: string | null
    messageCount?: number
}
export interface Message {
    role: 'user' | 'assistant'
    content: string
    files?: Attachment[]
    isWebSearch?: boolean
}

export interface Attachment {
    name: string
    url?: string
    type: 'image' | 'pdf' | 'docx' | 'csv' | 'text' | 'other'
    source: 'upload' | 'drive'
    file?: File
    extractedText?: string | null
}
