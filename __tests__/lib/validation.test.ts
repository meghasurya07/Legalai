import { describe, it, expect } from 'vitest'
import {
    sanitizeText,
    sanitizeShortText,
    isValidUUID,
    validateUUID,
    isValidEmail,
    validateEnum,
    validateInt,
    validateFileUpload,
    sanitizeObject,
} from '@/lib/validation'

// ─── sanitizeText ────────────────────────────────────────────────

describe('sanitizeText', () => {
    it('strips <script> tags', () => {
        const input = 'Hello <script>alert("xss")</script> World'
        expect(sanitizeText(input)).toBe('Hello  World')
    })

    it('strips <iframe> tags', () => {
        const input = 'Before <iframe src="evil.com"></iframe> After'
        expect(sanitizeText(input)).toBe('Before  After')
    })

    it('strips inline event handlers', () => {
        const input = '<div onmouseover="steal()">Hover</div>'
        expect(sanitizeText(input)).not.toContain('onmouseover')
    })

    it('strips javascript: URIs', () => {
        const input = '<a href="javascript:alert(1)">Click</a>'
        expect(sanitizeText(input)).not.toContain('javascript:')
    })

    it('strips null bytes', () => {
        const input = 'clean\0text'
        expect(sanitizeText(input)).toBe('cleantext')
    })

    it('truncates to maxLength', () => {
        const input = 'a'.repeat(200)
        expect(sanitizeText(input, 100)).toHaveLength(100)
    })

    it('returns empty string for non-string input', () => {
        expect(sanitizeText(null)).toBe('')
        expect(sanitizeText(undefined)).toBe('')
        expect(sanitizeText(42)).toBe('')
    })

    it('preserves markdown formatting', () => {
        const input = '**bold** and _italic_ and `code`'
        expect(sanitizeText(input)).toBe('**bold** and _italic_ and `code`')
    })
})

// ─── sanitizeShortText ──────────────────────────────────────────

describe('sanitizeShortText', () => {
    it('strips ALL HTML tags', () => {
        const input = '<b>Title</b> with <em>emphasis</em>'
        expect(sanitizeShortText(input)).toBe('Title with emphasis')
    })

    it('truncates to maxLength', () => {
        expect(sanitizeShortText('a'.repeat(1000), 50)).toHaveLength(50)
    })

    it('returns empty for non-string', () => {
        expect(sanitizeShortText(123)).toBe('')
    })
})

// ─── UUID Validation ────────────────────────────────────────────

describe('isValidUUID', () => {
    it('accepts valid UUID v4', () => {
        expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    })

    it('rejects short strings', () => {
        expect(isValidUUID('not-a-uuid')).toBe(false)
    })

    it('rejects non-strings', () => {
        expect(isValidUUID(123)).toBe(false)
        expect(isValidUUID(null)).toBe(false)
    })

    it('rejects SQL injection in UUID position', () => {
        expect(isValidUUID("'; DROP TABLE projects; --")).toBe(false)
    })
})

describe('validateUUID', () => {
    it('returns the UUID string when valid', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000'
        expect(validateUUID(uuid)).toBe(uuid)
    })

    it('returns undefined for invalid input', () => {
        expect(validateUUID('garbage')).toBeUndefined()
        expect(validateUUID(null)).toBeUndefined()
    })
})

// ─── Email Validation ───────────────────────────────────────────

describe('isValidEmail', () => {
    it('accepts standard emails', () => {
        expect(isValidEmail('user@example.com')).toBe(true)
        expect(isValidEmail('first.last@domain.org')).toBe(true)
    })

    it('rejects missing @', () => {
        expect(isValidEmail('userexample.com')).toBe(false)
    })

    it('rejects non-strings', () => {
        expect(isValidEmail(42)).toBe(false)
    })

    it('rejects extremely long emails', () => {
        const longEmail = 'a'.repeat(300) + '@example.com'
        expect(isValidEmail(longEmail)).toBe(false)
    })
})

// ─── Enum Validation ────────────────────────────────────────────

describe('validateEnum', () => {
    const allowed = ['assistant', 'vault', 'workflow'] as const

    it('returns value when in allowed list', () => {
        expect(validateEnum('vault', allowed)).toBe('vault')
    })

    it('returns undefined for values not in list', () => {
        expect(validateEnum('hacker', allowed)).toBeUndefined()
    })

    it('returns undefined for non-string', () => {
        expect(validateEnum(123, allowed)).toBeUndefined()
    })
})

// ─── Number Validation ──────────────────────────────────────────

describe('validateInt', () => {
    it('parses valid integers', () => {
        expect(validateInt(42)).toBe(42)
        expect(validateInt('100')).toBe(100)
    })

    it('rejects out-of-range values', () => {
        expect(validateInt(-1)).toBeNull()
        expect(validateInt(99999)).toBeNull()
    })

    it('rejects NaN / non-numeric', () => {
        expect(validateInt('abc')).toBeNull()
        expect(validateInt(null)).toBeNull()
    })

    it('floors floating point', () => {
        expect(validateInt(3.7)).toBe(3)
    })

    it('respects custom bounds', () => {
        expect(validateInt(5, 1, 10)).toBe(5)
        expect(validateInt(15, 1, 10)).toBeNull()
    })
})

// ─── File Upload Validation ─────────────────────────────────────

describe('validateFileUpload', () => {
    function makeFile(name: string, size: number, type: string): File {
        const buffer = new ArrayBuffer(size)
        return new File([buffer], name, { type })
    }

    it('accepts a valid PDF', () => {
        const result = validateFileUpload(makeFile('contract.pdf', 1024, 'application/pdf'))
        expect(result.valid).toBe(true)
    })

    it('rejects .exe files', () => {
        const result = validateFileUpload(makeFile('malware.exe', 1024, 'application/octet-stream'))
        expect(result.valid).toBe(false)
        expect(result.error).toContain('.exe')
    })

    it('rejects .sh files', () => {
        const result = validateFileUpload(makeFile('deploy.sh', 1024, 'text/plain'))
        expect(result.valid).toBe(false)
    })

    it('rejects .html files (can contain scripts)', () => {
        const result = validateFileUpload(makeFile('phishing.html', 1024, 'text/html'))
        expect(result.valid).toBe(false)
    })

    it('rejects empty files', () => {
        const result = validateFileUpload(makeFile('empty.pdf', 0, 'application/pdf'))
        expect(result.valid).toBe(false)
        expect(result.error).toContain('empty')
    })

    it('rejects files over 25 MB', () => {
        const result = validateFileUpload(makeFile('huge.pdf', 30 * 1024 * 1024, 'application/pdf'))
        expect(result.valid).toBe(false)
        expect(result.error).toContain('too large')
    })

    it('accepts .docx files', () => {
        const result = validateFileUpload(
            makeFile('brief.docx', 5000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        )
        expect(result.valid).toBe(true)
    })
})

// ─── sanitizeObject ─────────────────────────────────────────────

describe('sanitizeObject', () => {
    it('sanitizes nested string values', () => {
        const input = {
            title: '<script>bad</script>Clean Title',
            nested: { desc: '<iframe>gone</iframe>Safe' },
        }
        const result = sanitizeObject(input)
        expect(result.title).not.toContain('<script>')
        expect(result.nested.desc).not.toContain('<iframe>')
    })

    it('preserves non-string values', () => {
        const input = { count: 42, active: true, tags: ['a', 'b'] }
        const result = sanitizeObject(input)
        expect(result.count).toBe(42)
        expect(result.active).toBe(true)
    })

    it('sanitizes strings in arrays', () => {
        const input = ['<script>x</script>ok', 'clean']
        const result = sanitizeObject(input)
        expect(result[0]).not.toContain('<script>')
        expect(result[1]).toBe('clean')
    })
})
