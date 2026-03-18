/**
 * Input Validation & Sanitization Utilities
 *
 * Centralized validation for all API inputs to prevent:
 * - XSS (cross-site scripting)
 * - Script injection
 * - Oversized payloads
 * - Unsafe file uploads
 * - Invalid data types
 */

// ── Text Sanitization ──────────────────────────────────────────

/**
 * Strip dangerous HTML/script tags from text input.
 * Preserves markdown formatting (bold, italic, links, code blocks).
 */
export function sanitizeText(input: unknown, maxLength = 50000): string {
    if (typeof input !== 'string') return ''
    return input
        .replace(/<script[\s\S]*?<\/script>/gi, '')   // Remove <script> blocks
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')    // Remove <iframe> blocks
        .replace(/<object[\s\S]*?<\/object>/gi, '')    // Remove <object> blocks
        .replace(/<embed[\s\S]*?\/?>/gi, '')           // Remove <embed> tags
        .replace(/<link[\s\S]*?\/?>/gi, '')            // Remove <link> tags
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')  // Remove inline event handlers
        .replace(/javascript\s*:/gi, '')               // Remove javascript: URIs
        .replace(/data\s*:\s*text\/html/gi, '')        // Remove data:text/html URIs
        .replace(/\0/g, '')                            // Remove null bytes
        .trim()
        .slice(0, maxLength)
}

/**
 * Sanitize a short text field (title, name, etc.)
 * More aggressive — strips all HTML tags.
 */
export function sanitizeShortText(input: unknown, maxLength = 500): string {
    if (typeof input !== 'string') return ''
    return input
        .replace(/<[^>]*>/g, '')         // Strip ALL HTML tags
        .replace(/\0/g, '')             // Remove null bytes
        .trim()
        .slice(0, maxLength)
}

// ── UUID Validation ────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate that a string is a valid UUID v4.
 */
export function isValidUUID(input: unknown): boolean {
    return typeof input === 'string' && UUID_REGEX.test(input)
}

/**
 * Validate and return a UUID, or null if invalid.
 */
export function validateUUID(input: unknown): string | undefined {
    if (typeof input !== 'string') return undefined
    return UUID_REGEX.test(input) ? input : undefined
}

// ── Email Validation ───────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(input: unknown): boolean {
    return typeof input === 'string' && EMAIL_REGEX.test(input) && input.length <= 254
}

// ── Enum Validation ────────────────────────────────────────────

/**
 * Validate that a value is one of the allowed options.
 */
export function validateEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
    if (typeof value !== 'string') return undefined
    return allowed.includes(value as T) ? (value as T) : undefined
}

// ── Number Validation ──────────────────────────────────────────

/**
 * Parse and validate an integer within bounds.
 */
export function validateInt(input: unknown, min = 0, max = 10000): number | null {
    const num = typeof input === 'string' ? parseInt(input, 10) : typeof input === 'number' ? input : NaN
    if (isNaN(num) || num < min || num > max) return null
    return Math.floor(num)
}

// ── File Upload Validation ─────────────────────────────────────

/** Allowed document MIME types for the legal AI platform */
const ALLOWED_DOCUMENT_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp',
])

/** Dangerous file extensions that should NEVER be uploaded */
const BLOCKED_EXTENSIONS = new Set([
    'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
    'js', 'vbs', 'wsf', 'wsh', 'ps1', 'sh', 'bash',
    'php', 'py', 'rb', 'pl', 'cgi',
    'dll', 'sys', 'drv',
    'htm', 'html', 'svg',  // Can contain scripts
])

/** Max file size: 25 MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024

export interface FileValidationResult {
    valid: boolean
    error?: string
}

/**
 * Validate a file upload for safety.
 */
export function validateFileUpload(file: File): FileValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `File too large. Maximum size is 25 MB, got ${(file.size / 1024 / 1024).toFixed(1)} MB.` }
    }

    if (file.size === 0) {
        return { valid: false, error: 'File is empty.' }
    }

    // Check extension
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (BLOCKED_EXTENSIONS.has(ext)) {
        return { valid: false, error: `File type ".${ext}" is not allowed.` }
    }

    // Check MIME type
    if (file.type && !ALLOWED_DOCUMENT_TYPES.has(file.type)) {
        // Allow unknown MIME types (some systems don't set them) but block known dangerous ones
        const dangerousMimes = ['application/x-executable', 'application/x-msdownload', 'text/html', 'application/javascript']
        if (dangerousMimes.includes(file.type)) {
            return { valid: false, error: `File type "${file.type}" is not allowed.` }
        }
    }

    return { valid: true }
}

// ── Object Sanitization ────────────────────────────────────────

/**
 * Recursively sanitize all string values in an object.
 * Useful for sanitizing entire request bodies.
 */
export function sanitizeObject<T>(obj: T, maxStringLength = 50000): T {
    if (typeof obj === 'string') {
        return sanitizeText(obj, maxStringLength) as unknown as T
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, maxStringLength)) as unknown as T
    }
    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizeObject(value, maxStringLength)
        }
        return result as T
    }
    return obj
}
