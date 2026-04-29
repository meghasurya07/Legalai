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
    id?: string
    role: 'user' | 'assistant'
    content: string
    files?: Attachment[]
    isWebSearch?: boolean
}

export interface Attachment {
    id?: string
    name: string
    url?: string
    storageUrl?: string
    mimeType?: string
    size?: string | number
    type: 'image' | 'pdf' | 'docx' | 'csv' | 'text' | 'other'
    source: 'upload' | 'drive'
    file?: File
    extractedText?: string | null
}

// ============================================
// Calendar Types
// ============================================

export type CalendarEventType = 'meeting' | 'hearing' | 'deposition' | 'filing' | 'consultation' | 'internal' | 'other'
export type DeadlineType = 'filing' | 'statute_of_limitations' | 'discovery' | 'motion' | 'response' | 'compliance' | 'custom'
export type DeadlinePriority = 'critical' | 'high' | 'medium' | 'low'
export type DeadlineStatus = 'pending' | 'in_progress' | 'completed' | 'missed'
export type CalendarView = 'month' | 'week' | 'day' | 'agenda'

export interface CalendarEvent {
    id: string
    userId: string
    orgId?: string
    projectId?: string | null
    projectTitle?: string
    title: string
    description?: string
    eventType: CalendarEventType
    startAt: string
    endAt?: string
    allDay: boolean
    location?: string
    recurrenceRule?: string
    recurrenceEnd?: string
    color?: string
    caseNumber?: string | null
    courtName?: string | null
    judgeName?: string | null
    createdAt: string
    updatedAt: string
}

export interface Deadline {
    id: string
    userId: string
    orgId?: string
    projectId?: string | null
    projectTitle?: string
    title: string
    description?: string
    deadlineType: DeadlineType
    dueAt: string
    priority: DeadlinePriority
    status: DeadlineStatus
    remindBeforeMinutes: number
    completedAt?: string
    caseNumber?: string | null
    courtName?: string | null
    judgeName?: string | null
    createdAt: string
    updatedAt: string
}

export interface CalendarItem {
    id: string
    kind: 'event' | 'deadline'
    title: string
    date: string
    startAt: string
    endAt?: string
    allDay: boolean
    type: string
    priority?: DeadlinePriority
    status?: DeadlineStatus
    color: string
    projectTitle?: string
    projectId?: string | null
    location?: string
    description?: string
    caseNumber?: string | null
    courtName?: string | null
    judgeName?: string | null
}

export interface DeadlineAuditEntry {
    id: string
    deadlineId: string
    userId: string
    userName?: string
    action: 'created' | 'status_changed' | 'field_updated' | 'deleted'
    fieldChanged?: string
    oldValue?: string
    newValue?: string
    createdAt: string
}

// ============================================
// Document Drafting Types
// ============================================

export type DraftDocumentType = 'general' | 'contract' | 'memo' | 'brief' | 'letter' | 'motion'
export type DraftStatus = 'draft' | 'review' | 'final'

export interface Draft {
    id: string
    userId: string
    orgId?: string
    projectId?: string | null
    projectTitle?: string
    title: string
    content: unknown[]
    contentText: string
    documentType: DraftDocumentType
    wordCount: number
    status: DraftStatus
    isArchived: boolean
    createdAt: string
    updatedAt: string
}

export interface DraftVersion {
    id: string
    draftId: string
    content: unknown[]
    contentText: string
    wordCount: number
    versionNumber: number
    changeSummary?: string
    createdBy: string
    createdAt: string
}
