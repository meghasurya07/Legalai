import { describe, it, expect, vi } from 'vitest'

// Mock the modules that citation-engine imports
vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { CitationEngine } from '@/lib/ai/citation-engine'
import type { RetrievedChunk } from '@/lib/rag/retrieve'

// ─── Helper: create a mock RetrievedChunk ────────────────────────────
function mockChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
    return {
        id: 'chunk-abc-123',
        fileId: 'file-def-456',
        fileName: 'Contract_Agreement.pdf',
        fileUrl: null,
        content: 'The agreement was executed on February 11, 2013. The purchase price is set at $1.00 per share. Closing is contingent upon satisfaction of certain conditions precedent.',
        tokenCount: 50,
        chunkIndex: 3,
        similarity: 0.89,
        pageNumber: 5,
        sectionHeading: 'Purchase Terms',
        ...overrides,
    }
}

// ─── registerRAGSources ──────────────────────────────────────────────
describe('CitationEngine.registerRAGSources', () => {
    it('creates entries with correct metadata from chunks', () => {
        const engine = new CitationEngine()
        const chunk = mockChunk()
        engine.registerRAGSources([chunk])

        const entries = engine.getEntries()
        expect(entries).toHaveLength(1)
        expect(entries[0].id).toBe('rag-chunk-abc-123')
        expect(entries[0].num).toBe(1)
        expect(entries[0].type).toBe('rag')
        expect(entries[0].title).toBe('Contract_Agreement.pdf — Page 5 — Purchase Terms')
        expect(entries[0].url).toBe('https://documents.app/document/file-def-456?ci=3')
        expect(entries[0].metadata.fileId).toBe('file-def-456')
        expect(entries[0].metadata.chunkIndex).toBe(3)
        expect(entries[0].metadata.pageNumber).toBe(5)
        expect(entries[0].metadata.sectionHeading).toBe('Purchase Terms')
    })

    it('assigns sequential citation numbers', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([
            mockChunk({ id: 'chunk-1' }),
            mockChunk({ id: 'chunk-2' }),
            mockChunk({ id: 'chunk-3' }),
        ])

        const entries = engine.getEntries()
        expect(entries[0].num).toBe(1)
        expect(entries[1].num).toBe(2)
        expect(entries[2].num).toBe(3)
    })

    it('handles upload-prefixed fileIds with encoded URLs', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk({ fileId: 'upload-temp-xyz' })])

        const entries = engine.getEntries()
        expect(entries[0].url).toBe('https://upload.local/file/upload-temp-xyz')
    })

    it('handles chunks without page number and section heading', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk({ pageNumber: null, sectionHeading: null })])

        const entries = engine.getEntries()
        expect(entries[0].title).toBe('Contract_Agreement.pdf')
    })
})

// ─── validateMarkers ─────────────────────────────────────────────────
describe('CitationEngine.validateMarkers', () => {
    it('identifies valid markers that match registered sources', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk(), mockChunk({ id: 'chunk-2' })])

        const result = engine.validateMarkers('The contract was signed [1] and amended [2].')
        expect(result.validMarkers).toEqual([1, 2])
        expect(result.orphanedMarkers).toEqual([])
        expect(result.cleanedText).toBe('The contract was signed [1] and amended [2].')
    })

    it('removes orphaned markers that have no matching source', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk()])

        const result = engine.validateMarkers('Valid [1] and invalid [5] references.')
        expect(result.validMarkers).toEqual([1])
        expect(result.orphanedMarkers).toEqual([5])
        expect(result.cleanedText).toBe('Valid [1] and invalid references.')
    })

    it('handles text with no citation markers', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk()])

        const result = engine.validateMarkers('No citations here.')
        expect(result.validMarkers).toEqual([])
        expect(result.orphanedMarkers).toEqual([])
        expect(result.cleanedText).toBe('No citations here.')
    })

    it('handles text with all orphaned markers', () => {
        const engine = new CitationEngine()
        // No sources registered

        const result = engine.validateMarkers('All orphaned [1] and [2].')
        expect(result.validMarkers).toEqual([])
        expect(result.orphanedMarkers).toEqual([1, 2])
        expect(result.cleanedText).toBe('All orphaned and .')
    })
})

// ─── buildIndex ──────────────────────────────────────────────────────
describe('CitationEngine.buildIndex', () => {
    it('produces a valid CitationIndex with markerMap', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk(), mockChunk({ id: 'chunk-2' })])

        const index = engine.buildIndex('Some text [1] and more [2].')
        expect(index.entries).toHaveLength(2)
        expect(index.markerMap['1']).toBe(0)
        expect(index.markerMap['2']).toBe(1)
    })

    it('returns empty index when no sources registered', () => {
        const engine = new CitationEngine()
        const index = engine.buildIndex('No citations.')
        expect(index.entries).toHaveLength(0)
        expect(Object.keys(index.markerMap)).toHaveLength(0)
    })
})

// ─── serialize ───────────────────────────────────────────────────────
describe('CitationEngine.serialize', () => {
    it('produces valid JSON inside <!--CITATION_INDEX:...--> block', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk()])

        const serialized = engine.serialize()
        expect(serialized).toContain('<!--CITATION_INDEX:')
        expect(serialized).toContain('-->')

        // Extract and parse the JSON
        const match = serialized.match(/<!--CITATION_INDEX:([\s\S]*?)-->/)
        expect(match).not.toBeNull()
        const parsed = JSON.parse(match![1])
        expect(parsed.entries).toHaveLength(1)
        expect(parsed.entries[0].id).toBe('rag-chunk-abc-123')
        expect(parsed.markerMap['1']).toBe(0)
    })

    it('returns empty string when no citations registered', () => {
        const engine = new CitationEngine()
        expect(engine.serialize()).toBe('')
    })
})

// ─── findBestSnippet ─────────────────────────────────────────────────
describe('CitationEngine.findBestSnippet', () => {
    it('selects the most relevant sentence using word overlap', () => {
        const chunk = mockChunk({
            content: 'Section 1 is about definitions. The purchase price is one dollar per share. Closing conditions are detailed in Section 5.'
        })

        const engine = new CitationEngine()
        engine.registerRAGSources([chunk])

        const snippet = engine.findBestSnippet(
            chunk,
            'The purchase price was set at one dollar per share [1].',
            1
        )

        expect(snippet).toContain('purchase price')
    })

    it('handles legal-specific terms with bonus weighting', () => {
        const chunk = mockChunk({
            content: 'Article 1 covers general provisions. Under § 302 of the Sarbanes-Oxley Act, corporate officers must certify financial reports. Article 3 covers penalties.'
        })

        const engine = new CitationEngine()
        engine.registerRAGSources([chunk])

        const snippet = engine.findBestSnippet(
            chunk,
            'Under § 302 of the Sarbanes-Oxley Act, officers must certify reports [1].',
            1
        )

        expect(snippet).toContain('302')
    })

    it('returns content even when no marker found in response', () => {
        const chunk = mockChunk({ content: 'Some legal content about contracts.' })
        const engine = new CitationEngine()
        engine.registerRAGSources([chunk])

        const snippet = engine.findBestSnippet(chunk, 'Unrelated response text.', 99)
        expect(snippet.length).toBeGreaterThan(0)
    })
})

// ─── hasCitations ────────────────────────────────────────────────────
describe('CitationEngine.hasCitations', () => {
    it('returns false when no sources registered', () => {
        const engine = new CitationEngine()
        expect(engine.hasCitations()).toBe(false)
    })

    it('returns true after registering RAG sources', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([mockChunk()])
        expect(engine.hasCitations()).toBe(true)
    })
})

// ─── Integration: full pipeline ──────────────────────────────────────
describe('CitationEngine integration', () => {
    it('handles complete RAG citation pipeline', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([
            mockChunk({ id: 'c1', content: 'The contract was signed on January 1, 2024.' }),
            mockChunk({ id: 'c2', content: 'The termination clause allows 30-day notice.' }),
        ])

        const responseText = 'The contract was signed on January 1, 2024 [1]. Either party may terminate with 30 days notice [2]. An ungrounded claim [5].'

        // Validate markers
        const validation = engine.validateMarkers(responseText)
        expect(validation.validMarkers).toEqual([1, 2])
        expect(validation.orphanedMarkers).toEqual([5])
        expect(validation.cleanedText).not.toContain('[5]')
        expect(validation.cleanedText).toContain('[1]')
        expect(validation.cleanedText).toContain('[2]')

        // Build index
        const index = engine.buildIndex(validation.cleanedText)
        expect(index.entries).toHaveLength(2)

        // Serialize
        const serialized = engine.serialize()
        expect(serialized).toContain('<!--CITATION_INDEX:')
        const match = serialized.match(/<!--CITATION_INDEX:([\s\S]*?)-->/)
        const parsed = JSON.parse(match![1])
        expect(parsed.entries[0].type).toBe('rag')
        expect(parsed.entries[1].type).toBe('rag')
    })

    it('handles empty chunks gracefully', () => {
        const engine = new CitationEngine()
        engine.registerRAGSources([])

        expect(engine.hasCitations()).toBe(false)
        expect(engine.serialize()).toBe('')
        expect(engine.validateMarkers('No [1] sources.').orphanedMarkers).toEqual([1])
    })
})
