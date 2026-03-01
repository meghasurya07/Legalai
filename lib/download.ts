/**
 * Shared file download utility.
 * Used by translation, legal-memo, draft-from-template, and client-alert components.
 */

import { toast } from "sonner"

/**
 * Trigger a browser download of text content as a file.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${filename}`)
}
