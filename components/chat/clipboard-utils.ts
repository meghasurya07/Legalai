/**
 * Clipboard & screenshot utilities for the chat input.
 * Pure functions — no React dependency.
 */

const SUPPORTED_CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
}

export function getSupportedClipboardImageExtension(mimeType: string): string | null {
    return SUPPORTED_CLIPBOARD_IMAGE_EXTENSIONS[mimeType] || null
}

function padTimestampPart(value: number): string {
    return String(value).padStart(2, '0')
}

export function getScreenshotFileName(mimeType: string, index = 0, date = new Date()): string {
    const extension = getSupportedClipboardImageExtension(mimeType) || 'png'
    const timestamp = [
        date.getFullYear(),
        padTimestampPart(date.getMonth() + 1),
        padTimestampPart(date.getDate()),
    ].join('')
    const time = [
        padTimestampPart(date.getHours()),
        padTimestampPart(date.getMinutes()),
        padTimestampPart(date.getSeconds()),
    ].join('')
    const suffix = index > 0 ? `-${index + 1}` : ''

    return `screenshot-${timestamp}-${time}${suffix}.${extension}`
}

export function createScreenshotFile(file: File, index = 0, date = new Date()): File {
    return new File([file], getScreenshotFileName(file.type, index, date), {
        type: file.type,
        lastModified: date.getTime(),
    })
}
