import { describe, expect, it } from 'vitest'
import {
    parseSources,
    stripSourcesBlock,
    escapeCitationMarkers,
    getCitationSourceDisplayName,
    isDocumentSource,
    getDocumentRoute,
    getHostname,
    getFaviconUrl,
    parseCitationIndex,
    stripCitationIndexBlock,
} from '@/lib/citations'

// ────────────────────────────────────────────
// parseSources
// ────────────────────────────────────────────
describe('parseSources', () => {
    it('returns empty array when no sources block exists', () => {
        expect(parseSources('No sources here')).toEqual([])
    })

    it('parses a single source line', () => {
        const content = '<!--SOURCES:\n[1] Title | https://example.com | snippet text\n-->'
        const result = parseSources(content)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            num: '1',
            title: 'Title',
            url: 'https://example.com',
            snippet: 'snippet text',
        })
    })

    it('parses multiple source lines', () => {
        const content = '<!--SOURCES:\n[1] First | https://a.com | s1\n[2] Second | https://b.com | s2\n-->'
        expect(parseSources(content)).toHaveLength(2)
    })

    it('falls back to default URL when URL field is missing', () => {
        const content = '<!--SOURCES:\n[1] Title Only\n-->'
        const result = parseSources(content)
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('https://legal-source.internal')
    })

    it('ignores malformed lines', () => {
        const content = '<!--SOURCES:\nbad line\n[1] Good | https://ok.com\n-->'
        expect(parseSources(content)).toHaveLength(1)
    })

    it('strips non-URL values from URL field', () => {
        const content = '<!--SOURCES:\n[1] Title | notaurl | snippet\n-->'
        const result = parseSources(content)
        expect(result[0].url).toBe('https://legal-source.internal')
    })
})

// ────────────────────────────────────────────
// stripSourcesBlock
// ────────────────────────────────────────────
describe('stripSourcesBlock', () => {
    it('removes complete SOURCES block', () => {
        const input = 'Hello <!--SOURCES:\n[1] T | u\n--> world'
        expect(stripSourcesBlock(input)).toBe('Hello  world')
    })

    it('removes partial streaming block', () => {
        expect(stripSourcesBlock('Answer <!--SOUR')).toBe('Answer')
    })

    it('removes trailing <!-- during streaming', () => {
        expect(stripSourcesBlock('text <!--')).toBe('text')
    })

    it('returns original content when there is no sources block', () => {
        expect(stripSourcesBlock('plain text')).toBe('plain text')
    })
})

// ────────────────────────────────────────────
// escapeCitationMarkers
// ────────────────────────────────────────────
describe('escapeCitationMarkers', () => {
    it('escapes single citation marker', () => {
        expect(escapeCitationMarkers('see [1]')).toBe('see ⟦CITE_1⟧')
    })

    it('escapes multiple markers', () => {
        const result = escapeCitationMarkers('[1] and [2]')
        expect(result).toBe('⟦CITE_1⟧ and ⟦CITE_2⟧')
    })

    it('leaves text without markers unchanged', () => {
        expect(escapeCitationMarkers('no markers')).toBe('no markers')
    })

    it('handles markers with spaces', () => {
        expect(escapeCitationMarkers('[ 3 ]')).toBe('⟦CITE_3⟧')
    })
})

// ────────────────────────────────────────────
// getCitationSourceDisplayName
// ────────────────────────────────────────────
describe('getCitationSourceDisplayName', () => {
    it('extracts domain name from standard URL', () => {
        expect(getCitationSourceDisplayName('https://www.example.com/page', 'Example')).toBe('Example')
    })

    it('shortens long vault titles', () => {
        const longTitle = 'A Very Long Document Title That Is Definitely Over Twenty Five Characters - Details'
        expect(getCitationSourceDisplayName('https://vault.app/doc', longTitle)).toBe('A Very Long Document T...')
    })

    it('returns truncated title for invalid URLs', () => {
        expect(getCitationSourceDisplayName('not-a-url', 'A Really Long Title Here and More')).toBe('A Really Long Title ...')
    })
})

// ────────────────────────────────────────────
// isDocumentSource
// ────────────────────────────────────────────
describe('isDocumentSource', () => {
    it('returns false for empty string', () => {
        expect(isDocumentSource('')).toBe(false)
    })

    it('returns true for vault.app URLs', () => {
        expect(isDocumentSource('https://vault.app/doc/123')).toBe(true)
    })

    it('returns true for supabase URLs', () => {
        expect(isDocumentSource('https://abc.supabase.co/storage/file')).toBe(true)
    })

    it('returns true for legal-source.internal', () => {
        expect(isDocumentSource('https://legal-source.internal')).toBe(true)
    })

    it('returns false for external web URLs', () => {
        expect(isDocumentSource('https://google.com')).toBe(false)
    })

    it('returns true for non-http URLs', () => {
        expect(isDocumentSource('file:///path/to/doc')).toBe(true)
    })
})

// ────────────────────────────────────────────
// getDocumentRoute
// ────────────────────────────────────────────
describe('getDocumentRoute', () => {
    it('returns null for non-vault URLs', () => {
        expect(getDocumentRoute('https://google.com/path')).toBeNull()
    })

    it('extracts file ID route from vault.app URL', () => {
        expect(getDocumentRoute('https://vault.app/files/abc123')).toBe('/documents/document/abc123')
    })

    it('includes chunk index query param', () => {
        expect(getDocumentRoute('https://vault.app/files/abc?ci=5')).toBe('/documents/document/abc?ci=5')
    })

    it('returns null for invalid URL', () => {
        expect(getDocumentRoute('not-a-url')).toBeNull()
    })
})

// ────────────────────────────────────────────
// getHostname
// ────────────────────────────────────────────
describe('getHostname', () => {
    it('extracts hostname without www prefix', () => {
        expect(getHostname('https://www.example.com/page')).toBe('example.com')
    })

    it('returns hostname that has no www prefix', () => {
        expect(getHostname('https://docs.google.com')).toBe('docs.google.com')
    })

    it('returns null for invalid URL', () => {
        expect(getHostname('bad')).toBeNull()
    })
})

// ────────────────────────────────────────────
// getFaviconUrl
// ────────────────────────────────────────────
describe('getFaviconUrl', () => {
    it('builds Google favicon URL for valid domain', () => {
        const result = getFaviconUrl('https://example.com')
        expect(result).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=64')
    })

    it('accepts custom size', () => {
        const result = getFaviconUrl('https://example.com', 32)
        expect(result).toContain('sz=32')
    })

    it('returns null for invalid URL', () => {
        expect(getFaviconUrl('bad')).toBeNull()
    })
})

// ────────────────────────────────────────────
// parseCitationIndex — New structured format
// ────────────────────────────────────────────
describe('parseCitationIndex', () => {
    it('parses new JSON citation index format', () => {
        const index = { entries: [{ id: 'rag-1', num: 1, type: 'rag', title: 'Doc', url: 'https://x.com', snippet: 'snip', confidence: 1, metadata: {} }], markerMap: { '1': 0 } }
        const content = `Some text <!--CITATION_INDEX:${JSON.stringify(index)}-->`
        const result = parseCitationIndex(content)
        expect(result.entries).toHaveLength(1)
        expect(result.entries[0].id).toBe('rag-1')
        expect(result.entries[0].type).toBe('rag')
        expect(result.markerMap['1']).toBe(0)
    })

    it('falls back to legacy SOURCES format', () => {
        const content = '<!--SOURCES:\n[1] Title | https://example.com | snippet text\n-->'
        const result = parseCitationIndex(content)
        expect(result.entries).toHaveLength(1)
        expect(result.entries[0].id).toBe('legacy-1')
        expect(result.entries[0].title).toBe('Title')
        expect(result.entries[0].url).toBe('https://example.com')
        expect(result.entries[0].snippet).toBe('snippet text')
        expect(result.entries[0].type).toBe('rag')
        expect(result.markerMap['1']).toBe(0)
    })

    it('returns empty index for content with no citations', () => {
        const result = parseCitationIndex('No citations here')
        expect(result.entries).toHaveLength(0)
        expect(Object.keys(result.markerMap)).toHaveLength(0)
    })

    it('handles malformed JSON gracefully by falling back to legacy', () => {
        const content = '<!--CITATION_INDEX:{broken json-->'
        const result = parseCitationIndex(content)
        expect(result.entries).toHaveLength(0)
    })

    it('prefers new format over legacy when both exist', () => {
        const index = { entries: [{ id: 'new-1', num: 1, type: 'rag', title: 'New', url: 'https://new.com', snippet: '', confidence: 1, metadata: {} }], markerMap: { '1': 0 } }
        const content = `<!--SOURCES:\n[1] Old | https://old.com | old\n-->\n<!--CITATION_INDEX:${JSON.stringify(index)}-->`
        const result = parseCitationIndex(content)
        expect(result.entries[0].id).toBe('new-1')
        expect(result.entries[0].title).toBe('New')
    })
})

// ────────────────────────────────────────────
// stripCitationIndexBlock
// ────────────────────────────────────────────
describe('stripCitationIndexBlock', () => {
    it('strips complete CITATION_INDEX block', () => {
        const content = 'Hello world <!--CITATION_INDEX:{"entries":[]}-->'
        expect(stripCitationIndexBlock(content)).toBe('Hello world')
    })

    it('strips partial CITATION_INDEX block during streaming', () => {
        const content = 'Hello world <!--CITATION_IN'
        expect(stripCitationIndexBlock(content)).toBe('Hello world')
    })

    it('preserves content without CITATION_INDEX blocks', () => {
        const content = 'No citation blocks here [1]'
        expect(stripCitationIndexBlock(content)).toBe('No citation blocks here [1]')
    })
})

