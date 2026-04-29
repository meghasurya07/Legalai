import type { Attachment } from '@/types'

/**
 * Determine the attachment type from a File's MIME type and extension.
 */
export function getAttachmentType(file: File): Attachment['type'] {
    const fileName = file.name.toLowerCase()

    if (file.type.startsWith('image/')) return 'image'
    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf'
    if (fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
    if (fileName.endsWith('.csv') || file.type === 'text/csv') return 'csv'
    if (
        file.type.startsWith('text/') ||
        fileName.endsWith('.txt') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.ts') ||
        fileName.endsWith('.tsx') ||
        fileName.endsWith('.js') ||
        fileName.endsWith('.json')
    ) return 'text'

    return 'other'
}

/**
 * Split a list of files into unique and duplicate based on existing attachments.
 */
export interface QueuedFileSplit {
    uniqueFiles: File[]
    duplicateFiles: File[]
}

export function splitDuplicateFiles(files: File[], existingAttachments: Attachment[]): QueuedFileSplit {
    const seenNames = new Set(existingAttachments.map((file) => file.name))
    const uniqueFiles: File[] = []
    const duplicateFiles: File[] = []

    for (const file of files) {
        if (seenNames.has(file.name)) {
            duplicateFiles.push(file)
            continue
        }

        uniqueFiles.push(file)
        seenNames.add(file.name)
    }

    return { uniqueFiles, duplicateFiles }
}

/**
 * Create a display Attachment from a raw File object.
 */
export function createAttachmentFromFile(file: File, objectUrl = URL.createObjectURL(file)): Attachment {
    return {
        name: file.name,
        url: objectUrl,
        type: getAttachmentType(file),
        source: 'upload',
        file,
        mimeType: file.type || undefined,
        size: file.size,
    }
}

/**
 * Revoke a single blob URL to prevent memory leaks.
 */
export function revokeAttachmentObjectUrl(attachment: Attachment) {
    if (
        attachment.url?.startsWith('blob:') &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function'
    ) {
        URL.revokeObjectURL(attachment.url)
    }
}

/**
 * Revoke all blob URLs for a list of attachments.
 */
export function revokeAttachmentObjectUrls(attachments: Attachment[]) {
    attachments.forEach(revokeAttachmentObjectUrl)
}

// ─── Upload / Transform Utilities ──────────────────────────────────

/**
 * Payload shape sent to the /api/chat endpoint for each file.
 */
export interface ChatUploadPayload {
    id?: string
    name: string
    type: Attachment['type']
    source: Attachment['source']
    url?: string
    storageUrl?: string
    mimeType?: string
    size?: string | number
    content?: string | null
}

/**
 * Upload a single attachment to `/api/documents/upload` (or fall back to inline text).
 */
export async function uploadAttachmentForChat(attachment: Attachment): Promise<ChatUploadPayload> {
    if (attachment.source === 'drive' || !attachment.file) {
        return {
            id: attachment.id,
            name: attachment.name,
            type: attachment.type,
            source: attachment.source,
            url: attachment.url,
            storageUrl: attachment.storageUrl,
            mimeType: attachment.mimeType,
            size: attachment.size,
            content: attachment.extractedText,
        }
    }

    try {
        const formData = new FormData()
        formData.append('file', attachment.file)
        const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })

        if (!res.ok) {
            throw new Error('Upload failed')
        }

        const data = await res.json()
        return {
            id: data.id,
            name: data.name || attachment.name,
            type: attachment.type,
            source: 'upload',
            url: data.url,
            storageUrl: data.storageUrl,
            mimeType: data.mimeType || data.type || attachment.file.type || attachment.mimeType,
            size: data.size || attachment.size,
            content: attachment.type === 'image' ? null : data.content,
        }
    } catch (error) {
        if (attachment.type === 'image') {
            throw error
        }

        let content = ''
        if (attachment.type === 'text' || attachment.type === 'csv' || attachment.type === 'other') {
            content = await attachment.file.text()
        }

        return {
            name: attachment.name,
            type: attachment.type,
            source: attachment.source,
            url: attachment.url,
            storageUrl: attachment.storageUrl,
            mimeType: attachment.file.type || attachment.mimeType,
            size: attachment.size,
            content,
        }
    }
}

/**
 * Merge an original Attachment with the processed upload payload for display.
 */
export function toDisplayAttachment(original: Attachment, processed: ChatUploadPayload): Attachment {
    return {
        ...original,
        id: processed.id,
        name: processed.name || original.name,
        type: processed.type,
        source: processed.source,
        url: processed.url || original.url,
        storageUrl: processed.storageUrl || original.storageUrl,
        mimeType: processed.mimeType || original.mimeType,
        size: processed.size || original.size,
        extractedText: processed.content ?? original.extractedText,
        file: undefined,
    }
}

/**
 * Convert an upload payload into a minimal Attachment for database persistence.
 */
export function toPersistedAttachment(file: ChatUploadPayload): Attachment {
    return {
        id: file.id,
        name: file.name,
        type: file.type,
        source: file.source,
        url: file.url,
        storageUrl: file.storageUrl,
        mimeType: file.mimeType,
        size: file.size,
    }
}
