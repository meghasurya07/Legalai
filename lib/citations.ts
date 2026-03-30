/**
 * Shared citation and source parsing utilities.
 * Used by both chat-interface.tsx and markdown-renderer.tsx.
 */

export type ChatCitationSource = {
    num: string
    title: string
    url: string
    snippet?: string
}

/**
 * Parse the <!--SOURCES:...--> block from AI response content.
 */
export function parseSources(content: string): ChatCitationSource[] {
    const sourcesMatch = content.match(/<!--\s*SOURCES:?\s*([\s\S]*?)(?:-->|$)/i)
    if (!sourcesMatch) return []

    return sourcesMatch[1].trim().split('\n').map((line: string) => {
        const match = line.match(/\[(\d+)\]\s*([^|]+)(?:\s*\|\s*([^|]*?))?(?:\s*\|\s*(.*))?$/)
        if (!match) return null

        let url = (match[3] || '').trim()
        if (url && !url.startsWith('http') && !url.includes('.')) {
            url = ''
        }

        return {
            num: match[1],
            title: match[2].trim(),
            url: url || 'https://legal-source.internal',
            snippet: (match[4] || '').trim()
        } as ChatCitationSource
    }).filter((x): x is ChatCitationSource => x !== null)
}

/**
 * Strip <!--SOURCES:...--> blocks from content for display.
 * Handles both complete and partial (streaming) blocks.
 */
export function stripSourcesBlock(content: string): string {
    return content
        .replace(/<!--\s*SOURCES:?[\s\S]*?-->/gi, '')           // complete blocks
        .replace(/<!--\s*S(?:O(?:U(?:R(?:C(?:E(?:S)?)?)?)?)?)?[\s\S]*$/i, '')  // partial during streaming
        .replace(/<!--\s*$/i, '')                              // just "<!--"
        .trim()
}

/**
 * Escape citation markers [1], [2] etc. with unique placeholders
 * that survive markdown parsing.
 */
export function escapeCitationMarkers(text: string): string {
    return text.replace(/\[\s*(\d+)\s*\]/g, '⟦CITE_$1⟧')
}

/**
 * Get a user-friendly display name for a citation source URL.
 */
export function getCitationSourceDisplayName(url: string, title: string): string {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.replace('www.', '')

        if (hostname === 'vault.app' || hostname === 'documents.app' || hostname.includes('supabase') || hostname === 'vault.local' || hostname === 'upload.local' || hostname === 'legal-source.internal') {
            const fileName = title.split(' - ')[0].split(' — ')[0]
            return fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName
        }

        const domainParts = hostname.split('.')
        if (domainParts.length >= 2) {
            const domainName = domainParts[domainParts.length - 2]
            return domainName.charAt(0).toUpperCase() + domainName.slice(1)
        }
        return hostname
    } catch {
        return title.length > 20 ? title.substring(0, 20) + '...' : title
    }
}

/**
 * Check if a URL points to an internal document source.
 */
export function isDocumentSource(url: string): boolean {
    if (!url) return false
    const lowerUrl = url.toLowerCase()

    if (!lowerUrl.startsWith('http')) return true

    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.replace('www.', '')
        return (
            hostname === 'vault.app' ||
            hostname === 'documents.app' ||
            hostname.includes('supabase') ||
            hostname === 'vault.local' ||
            hostname === 'upload.local' ||
            hostname === 'legal-source.internal'
        )
    } catch {
        return true
    }
}

/**
 * Extract in-app route from vault.app URL: /documents/document/{fileId}?ci={chunkIndex}
 */
export function getDocumentRoute(url: string): string | null {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.replace('www.', '')
        // Accept both vault.app and documents.app as internal document hostnames
        const isInternalHost = (
            hostname === 'vault.app' ||
            hostname === 'documents.app' ||
            hostname === 'vault.local' ||
            hostname === 'legal-source.internal'
        )
        if (!isInternalHost) return null
        const pathParts = urlObj.pathname.split('/').filter(Boolean)
        // Path format: /document/{fileId}
        const docIdx = pathParts.indexOf('document')
        if (docIdx !== -1 && docIdx + 1 < pathParts.length) {
            const fileId = pathParts[docIdx + 1]
            const ci = urlObj.searchParams.get('ci')
            return `/documents/document/${fileId}${ci ? `?ci=${ci}` : ''}`
        }
        // Fallback: last path segment as fileId
        const fileId = pathParts[pathParts.length - 1]
        if (!fileId) return null
        const ci = urlObj.searchParams.get('ci')
        return `/documents/document/${fileId}${ci ? `?ci=${ci}` : ''}`
    } catch {
        return null
    }
}

/**
 * Get the hostname from a URL, stripping www. prefix.
 */
export function getHostname(url: string): string | null {
    try {
        const urlObj = new URL(url)
        return urlObj.hostname.replace('www.', '')
    } catch {
        return null
    }
}

/**
 * Get a Google Favicon URL for a given source URL.
 */
export function getFaviconUrl(url: string, size: number = 64): string | null {
    try {
        const host = getHostname(url)
        if (!host) {
            const u = new URL(url)
            return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=${size}`
        }
        return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`
    } catch {
        return null
    }
}

/**
 * Parse a document citation URL to extract fileId and chunkIndex.
 * Handles both vault.app URLs (from SOURCES blocks) and documents.app URLs.
 * 
 * Examples:
 *   https://vault.app/document/abc-123?ci=5
 *   https://documents.app/document/abc-123?ci=5
 */
export function parseDocumentCitationUrl(url: string): { fileId: string; chunkIndex: number } | null {
    try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(Boolean)
        // Path format: /document/{fileId} or /file/{fileId}
        const docIdx = pathParts.indexOf('document')
        const fileIdx = pathParts.indexOf('file')
        
        let fileId = ''
        if (docIdx !== -1 && docIdx + 1 < pathParts.length) {
            fileId = pathParts[docIdx + 1]
        } else if (fileIdx !== -1 && fileIdx + 1 < pathParts.length) {
            fileId = pathParts[fileIdx + 1]
        } else {
            return null
        }

        const ci = parseInt(urlObj.searchParams.get('ci') || '0', 10)

        return { fileId: decodeURIComponent(fileId), chunkIndex: isNaN(ci) ? 0 : ci }
    } catch {
        return null
    }
}
