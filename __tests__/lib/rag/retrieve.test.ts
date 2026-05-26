/**
 * Tests for RAG Retrieval Engine — Pure Logic Functions
 *
 * Strategy: Private pure functions are re-implemented here (they have zero
 * external dependencies) so we can unit-test their algorithmic behaviour
 * directly without needing to export them from the source module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Re-implemented private types & functions (mirror of retrieve.ts logic)
// ─────────────────────────────────────────────────────────────────────────────

interface RetrievedChunk {
  id: string
  fileId: string
  fileName: string | null
  fileUrl: string | null
  content: string
  tokenCount: number
  chunkIndex: number
  similarity: number
  pageNumber: number | null
  sectionHeading: string | null
  rrfScore?: number
  textRank?: number
}

// ── M3: Embedding Cache ────────────────────────────────────────────────────

const EMBEDDING_CACHE_MAX = 200
let embeddingCache: Map<string, { embedding: number[]; timestamp: number }>

function getCachedEmbedding(key: string): number[] | null {
  const entry = embeddingCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > 10 * 60 * 1000) {
    embeddingCache.delete(key)
    return null
  }
  return entry.embedding
}

function setCachedEmbedding(key: string, embedding: number[]): void {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const oldest = embeddingCache.keys().next().value
    if (oldest) embeddingCache.delete(oldest)
  }
  embeddingCache.set(key, { embedding, timestamp: Date.now() })
}

// ── H5: Chunk Adjacency Merging ────────────────────────────────────────────

function mergeAdjacentChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  if (chunks.length <= 1) return chunks

  const byFile = new Map<string, RetrievedChunk[]>()
  for (const chunk of chunks) {
    const existing = byFile.get(chunk.fileId) || []
    existing.push(chunk)
    byFile.set(chunk.fileId, existing)
  }

  const merged: RetrievedChunk[] = []

  for (const [, fileChunks] of byFile) {
    fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

    let current = { ...fileChunks[0] }

    for (let i = 1; i < fileChunks.length; i++) {
      const next = fileChunks[i]

      if (next.chunkIndex === current.chunkIndex + 1) {
        current = {
          ...current,
          content: current.content + '\n\n' + next.content,
          tokenCount: current.tokenCount + next.tokenCount,
          chunkIndex: next.chunkIndex,
          similarity: Math.max(current.similarity, next.similarity),
          rrfScore: Math.max(current.rrfScore || 0, next.rrfScore || 0) || undefined,
        }
      } else {
        merged.push(current)
        current = { ...next }
      }
    }

    merged.push(current)
  }

  merged.sort((a, b) => {
    if (a.rrfScore && b.rrfScore) return b.rrfScore - a.rrfScore
    return b.similarity - a.similarity
  })

  return merged
}

// ── C2: Keyword Re-ranking ─────────────────────────────────────────────────

function reRankChunks(chunks: RetrievedChunk[], query: string): RetrievedChunk[] {
  if (chunks.length <= 1) return chunks

  const queryLower = query.toLowerCase()
  const queryWords = queryLower
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)

  const queryBigrams: string[] = []
  for (let i = 0; i < queryWords.length - 1; i++) {
    queryBigrams.push(`${queryWords[i]} ${queryWords[i + 1]}`)
  }

  const scored = chunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase()
    let keywordScore = 0

    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = contentLower.match(regex)
      if (matches) {
        keywordScore += Math.min(matches.length, 3) * 2
      }
    }

    for (const bigram of queryBigrams) {
      if (contentLower.includes(bigram)) {
        keywordScore += 3
      }
    }

    if (chunk.sectionHeading) {
      const headingLower = chunk.sectionHeading.toLowerCase()
      for (const word of queryWords) {
        if (headingLower.includes(word)) {
          keywordScore += 2
        }
      }
    }

    const boost = 1 + (keywordScore * 0.1)
    const reRankedSimilarity = chunk.similarity * Math.min(boost, 2.0)

    return { chunk, reRankedSimilarity, keywordScore }
  })

  scored.sort((a, b) => b.reRankedSimilarity - a.reRankedSimilarity)

  return scored.map(s => ({
    ...s.chunk,
    similarity: s.reRankedSimilarity,
  }))
}

// ── Content Overlap Similarity ─────────────────────────────────────────────

function contentOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a.toLowerCase().replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 3)
  )
  const wordsB = new Set(
    b.toLowerCase().replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 3)
  )
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersection = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++
  }
  return intersection / (wordsA.size + wordsB.size - intersection)
}

// ── M2: MMR Diversity ──────────────────────────────────────────────────────

function applyMMR(
  chunks: RetrievedChunk[],
  _queryEmbedding: number[],
  lambda: number = 0.7
): RetrievedChunk[] {
  if (chunks.length <= 1) return chunks

  const remaining = [...chunks]
  const selected: RetrievedChunk[] = []

  remaining.sort((a, b) => b.similarity - a.similarity)
  selected.push(remaining.shift()!)

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestMMR = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]
      const relevance = candidate.similarity

      let maxSimToSelected = 0
      for (const sel of selected) {
        const sim = contentOverlapSimilarity(candidate.content, sel.content)
        if (sim > maxSimToSelected) maxSimToSelected = sim
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected

      if (mmrScore > bestMMR) {
        bestMMR = mmrScore
        bestIdx = i
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0])
  }

  return selected
}

// ── M1: Metadata Filters ──────────────────────────────────────────────────

interface MetadataFilters {
  fileType?: string
  fileName?: string
  uploadedAfter?: string
  uploadedBefore?: string
}

function applyMetadataFilters(
  candidates: Record<string, unknown>[],
  filters: MetadataFilters
): Record<string, unknown>[] {
  return candidates.filter(candidate => {
    if (filters.fileType) {
      const candidateType = candidate.file_type as string | undefined
      if (!candidateType || candidateType !== filters.fileType) return false
    }

    if (filters.fileName) {
      const candidateName = candidate.file_name as string | undefined
      if (!candidateName) return false
      const pattern = filters.fileName
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.')
      const regex = new RegExp(`^${pattern}$`, 'i')
      if (!regex.test(candidateName)) return false
    }

    if (filters.uploadedAfter) {
      const uploadedAt = candidate.created_at as string | undefined
      if (!uploadedAt || new Date(uploadedAt) <= new Date(filters.uploadedAfter)) return false
    }

    if (filters.uploadedBefore) {
      const uploadedAt = candidate.created_at as string | undefined
      if (!uploadedAt || new Date(uploadedAt) >= new Date(filters.uploadedBefore)) return false
    }

    return true
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: 'chunk-1',
    fileId: 'file-1',
    fileName: 'contract.pdf',
    fileUrl: null,
    content: 'Default chunk content for testing purposes.',
    tokenCount: 10,
    chunkIndex: 0,
    similarity: 0.8,
    pageNumber: null,
    sectionHeading: null,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RAG Retrieval Engine — Pure Logic', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // M3: Embedding Cache
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Embedding Cache (M3)', () => {
    beforeEach(() => {
      embeddingCache = new Map()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('getCachedEmbedding returns null for unknown keys', () => {
      expect(getCachedEmbedding('non-existent-key')).toBeNull()
    })

    it('setCachedEmbedding stores and getCachedEmbedding retrieves correctly', () => {
      const embedding = [0.1, 0.2, 0.3]
      setCachedEmbedding('test-query', embedding)
      expect(getCachedEmbedding('test-query')).toEqual([0.1, 0.2, 0.3])
    })

    it('cache expires after 10 minutes', () => {
      vi.useFakeTimers()
      const embedding = [1.0, 2.0]
      setCachedEmbedding('expiring', embedding)

      // Still valid just before 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000 - 1)
      expect(getCachedEmbedding('expiring')).toEqual([1.0, 2.0])

      // Expired at 10 minutes + 1ms
      vi.advanceTimersByTime(2)
      expect(getCachedEmbedding('expiring')).toBeNull()
    })

    it('expired entry is deleted from the cache', () => {
      vi.useFakeTimers()
      setCachedEmbedding('gone', [9, 8, 7])
      vi.advanceTimersByTime(11 * 60 * 1000)

      // First call returns null AND deletes
      getCachedEmbedding('gone')
      expect(embeddingCache.has('gone')).toBe(false)
    })

    it('cache evicts oldest entry when full (200 max)', () => {
      // Fill cache to capacity
      for (let i = 0; i < EMBEDDING_CACHE_MAX; i++) {
        setCachedEmbedding(`key-${i}`, [i])
      }
      expect(embeddingCache.size).toBe(200)

      // Add one more — should evict "key-0" (the oldest/first)
      setCachedEmbedding('new-key', [999])
      expect(embeddingCache.size).toBe(200)
      expect(getCachedEmbedding('key-0')).toBeNull()
      expect(getCachedEmbedding('new-key')).toEqual([999])
    })

    it('evicts only one entry per insertion when full', () => {
      for (let i = 0; i < EMBEDDING_CACHE_MAX; i++) {
        setCachedEmbedding(`k-${i}`, [i])
      }

      setCachedEmbedding('extra-1', [100])
      setCachedEmbedding('extra-2', [200])

      // k-0 and k-1 should be evicted, k-2 should survive
      expect(getCachedEmbedding('k-0')).toBeNull()
      expect(getCachedEmbedding('k-1')).toBeNull()
      expect(getCachedEmbedding('k-2')).toEqual([2])
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // H5: Chunk Adjacency Merging
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Chunk Adjacency Merging (H5)', () => {
    it('returns empty array unchanged', () => {
      expect(mergeAdjacentChunks([])).toEqual([])
    })

    it('single chunk returns unchanged', () => {
      const chunk = makeChunk()
      const result = mergeAdjacentChunks([chunk])
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe(chunk.content)
    })

    it('adjacent chunks (consecutive chunkIndex) from same file merge', () => {
      const c1 = makeChunk({ id: 'c1', chunkIndex: 0, content: 'Part A', tokenCount: 5, similarity: 0.9 })
      const c2 = makeChunk({ id: 'c2', chunkIndex: 1, content: 'Part B', tokenCount: 7, similarity: 0.7 })

      const result = mergeAdjacentChunks([c1, c2])
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Part A\n\nPart B')
      expect(result[0].tokenCount).toBe(12)
    })

    it('merged chunk keeps max similarity', () => {
      const c1 = makeChunk({ id: 'c1', chunkIndex: 0, similarity: 0.6 })
      const c2 = makeChunk({ id: 'c2', chunkIndex: 1, similarity: 0.9 })

      const result = mergeAdjacentChunks([c1, c2])
      expect(result[0].similarity).toBe(0.9)
    })

    it('non-adjacent chunks stay separate', () => {
      const c1 = makeChunk({ id: 'c1', chunkIndex: 0, similarity: 0.8 })
      const c2 = makeChunk({ id: 'c2', chunkIndex: 3, similarity: 0.7 })

      const result = mergeAdjacentChunks([c1, c2])
      expect(result).toHaveLength(2)
    })

    it('chunks from different files never merge even if indices are adjacent', () => {
      const c1 = makeChunk({ id: 'c1', fileId: 'file-A', chunkIndex: 0, similarity: 0.8 })
      const c2 = makeChunk({ id: 'c2', fileId: 'file-B', chunkIndex: 1, similarity: 0.7 })

      const result = mergeAdjacentChunks([c1, c2])
      expect(result).toHaveLength(2)
    })

    it('merges three consecutive chunks into one', () => {
      const chunks = [
        makeChunk({ id: 'c1', chunkIndex: 2, content: 'A', tokenCount: 3, similarity: 0.5 }),
        makeChunk({ id: 'c2', chunkIndex: 3, content: 'B', tokenCount: 4, similarity: 0.8 }),
        makeChunk({ id: 'c3', chunkIndex: 4, content: 'C', tokenCount: 5, similarity: 0.6 }),
      ]

      const result = mergeAdjacentChunks(chunks)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('A\n\nB\n\nC')
      expect(result[0].tokenCount).toBe(12)
      expect(result[0].similarity).toBe(0.8)
    })

    it('partial adjacency: merges only the adjacent pair', () => {
      const chunks = [
        makeChunk({ id: 'c1', chunkIndex: 0, content: 'X', similarity: 0.9 }),
        makeChunk({ id: 'c2', chunkIndex: 1, content: 'Y', similarity: 0.7 }),
        makeChunk({ id: 'c3', chunkIndex: 5, content: 'Z', similarity: 0.6 }),
      ]

      const result = mergeAdjacentChunks(chunks)
      expect(result).toHaveLength(2)
      // The merged chunk (sim 0.9) should be first after re-sort
      expect(result[0].content).toBe('X\n\nY')
    })

    it('result is re-sorted by similarity descending after merging', () => {
      const chunks = [
        makeChunk({ id: 'c1', fileId: 'f-1', chunkIndex: 0, similarity: 0.5 }),
        makeChunk({ id: 'c2', fileId: 'f-2', chunkIndex: 0, similarity: 0.9 }),
      ]

      const result = mergeAdjacentChunks(chunks)
      expect(result[0].similarity).toBe(0.9)
      expect(result[1].similarity).toBe(0.5)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // C2: Re-ranking
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Re-ranking (C2)', () => {
    it('single chunk is returned unchanged', () => {
      const chunk = makeChunk({ content: 'some text here' })
      const result = reRankChunks([chunk], 'some query')
      expect(result).toHaveLength(1)
    })

    it('exact query term matches boost score', () => {
      const relevant = makeChunk({
        id: 'relevant',
        content: 'The indemnification clause protects against liability damages',
        similarity: 0.7,
      })
      const irrelevant = makeChunk({
        id: 'irrelevant',
        content: 'The weather today is sunny and warm outside',
        similarity: 0.7,
      })

      const result = reRankChunks([irrelevant, relevant], 'indemnification liability damages')

      // relevant chunk should now rank higher
      expect(result[0].id).toBe('relevant')
      expect(result[0].similarity).toBeGreaterThan(0.7)
    })

    it('bi-gram matches get higher boost (+3 vs +2 per term)', () => {
      const bigramChunk = makeChunk({
        id: 'bigram',
        content: 'The force majeure clause applies in case of natural disaster',
        similarity: 0.6,
      })
      const unigramChunk = makeChunk({
        id: 'unigram',
        // Contains "force" and "majeure" but NOT as a bi-gram pair (not adjacent in the same way)
        content: 'The majeure obligation requires reasonable force in arbitration',
        similarity: 0.6,
      })

      const result = reRankChunks([unigramChunk, bigramChunk], 'force majeure clause')

      // bigram chunk should rank higher because it gets the +3 bi-gram bonus
      expect(result[0].id).toBe('bigram')
    })

    it('section heading matches add bonus', () => {
      const withHeading = makeChunk({
        id: 'headed',
        content: 'Various provisions apply here regarding the agreement.',
        sectionHeading: 'Termination Clause',
        similarity: 0.7,
      })
      const withoutHeading = makeChunk({
        id: 'plain',
        content: 'Various provisions apply here regarding the agreement.',
        sectionHeading: null,
        similarity: 0.7,
      })

      const result = reRankChunks([withoutHeading, withHeading], 'termination clause')

      expect(result[0].id).toBe('headed')
      expect(result[0].similarity).toBeGreaterThan(result[1].similarity)
    })

    it('boost is capped at 2x original similarity', () => {
      // Create a chunk that would receive a massive keyword score
      const chunk1 = makeChunk({
        id: 'massive',
        content: 'contract contract contract agreement agreement agreement liability liability liability indemnification indemnification indemnification',
        sectionHeading: 'Contract Agreement Liability',
        similarity: 0.5,
      })
      const chunk2 = makeChunk({
        id: 'other',
        content: 'unrelated content entirely different words nothing matches here',
        similarity: 0.5,
      })

      const result = reRankChunks(
        [chunk1, chunk2],
        'contract agreement liability indemnification'
      )

      // Even with huge keyword score, the boost should be capped at 2x = 1.0
      expect(result[0].similarity).toBeLessThanOrEqual(0.5 * 2.0)
    })

    it('words with 2 or fewer characters are ignored in query', () => {
      const chunk1 = makeChunk({ id: 'c1', content: 'The contract is valid', similarity: 0.8 })
      const chunk2 = makeChunk({ id: 'c2', content: 'An agreement was signed', similarity: 0.8 })

      // Only "is" and "an" are in query — both ≤ 2 chars, so no boost
      const result = reRankChunks([chunk1, chunk2], 'is an')
      // Both should keep original similarity (no words pass the > 2 filter)
      expect(result[0].similarity).toBe(0.8)
      expect(result[1].similarity).toBe(0.8)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // M2: MMR Diversity
  // ═══════════════════════════════════════════════════════════════════════════
  describe('MMR Diversity (M2)', () => {
    it('single chunk is returned as-is', () => {
      const chunk = makeChunk()
      const result = applyMMR([chunk], [0.1, 0.2])
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(chunk.id)
    })

    it('most relevant chunk is picked first', () => {
      const low = makeChunk({ id: 'low', similarity: 0.3, content: 'completely unique words here alpha beta gamma' })
      const high = makeChunk({ id: 'high', similarity: 0.9, content: 'different distinct text delta epsilon zeta' })

      const result = applyMMR([low, high], [0.1])
      expect(result[0].id).toBe('high')
    })

    it('identical chunks get penalized (diversity)', () => {
      const sameContent = 'The contractual obligation requires indemnification of all parties involved in the transaction.'
      const c1 = makeChunk({ id: 'c1', similarity: 0.9, content: sameContent })
      const c2 = makeChunk({ id: 'c2', similarity: 0.85, content: sameContent })
      const different = makeChunk({
        id: 'diff',
        similarity: 0.8,
        content: 'Weather patterns indicate drought conditions across the region causing severe agricultural losses.',
      })

      const result = applyMMR([c1, c2, different], [0.1], 0.5)

      // c1 is picked first (highest similarity)
      expect(result[0].id).toBe('c1')
      // "different" should be picked second because c2 is penalised for overlap with c1
      expect(result[1].id).toBe('diff')
    })

    it('lambda=1.0 gives pure relevance ordering (no diversity penalty)', () => {
      const sameContent = 'The agreement stipulates various conditions for termination and renewal procedures.'
      const c1 = makeChunk({ id: 'c1', similarity: 0.95, content: sameContent })
      const c2 = makeChunk({ id: 'c2', similarity: 0.90, content: sameContent })
      const c3 = makeChunk({ id: 'c3', similarity: 0.85, content: sameContent })

      const result = applyMMR([c1, c2, c3], [0.1], 1.0)

      // Pure relevance: c1 > c2 > c3 regardless of overlap
      expect(result[0].id).toBe('c1')
      expect(result[1].id).toBe('c2')
      expect(result[2].id).toBe('c3')
    })

    it('lambda=0.0 gives pure diversity ordering', () => {
      const sharedContent = 'The applicable jurisdiction governs arbitration proceedings under international trade laws.'
      const c1 = makeChunk({ id: 'c1', similarity: 0.9, content: sharedContent })
      const c2 = makeChunk({ id: 'c2', similarity: 0.85, content: sharedContent })
      const unique = makeChunk({
        id: 'unique',
        similarity: 0.5,
        content: 'Photosynthesis converts sunlight into chemical energy through chloroplasts in plant cells.',
      })

      const result = applyMMR([c1, c2, unique], [0.1], 0.0)

      // c1 picked first (initial sort by relevance)
      expect(result[0].id).toBe('c1')
      // With lambda=0, the second pick maximises diversity — "unique" has zero overlap with c1
      expect(result[1].id).toBe('unique')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Content Overlap Similarity
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Content Overlap Similarity', () => {
    it('identical texts return 1.0', () => {
      const text = 'The contractual obligation requires indemnification'
      expect(contentOverlapSimilarity(text, text)).toBe(1.0)
    })

    it('completely different texts return 0.0', () => {
      const a = 'The contractual obligation requires indemnification'
      const b = 'Weather patterns indicate drought conditions'
      expect(contentOverlapSimilarity(a, b)).toBe(0.0)
    })

    it('short words (under 4 chars) are excluded', () => {
      // All words ≤ 3 chars → treated as empty → returns 0
      const a = 'the to be or not an'
      const b = 'the to be or not an'
      expect(contentOverlapSimilarity(a, b)).toBe(0)
    })

    it('empty strings return 0', () => {
      expect(contentOverlapSimilarity('', '')).toBe(0)
      expect(contentOverlapSimilarity('some content', '')).toBe(0)
      expect(contentOverlapSimilarity('', 'some content')).toBe(0)
    })

    it('partial overlap returns value between 0 and 1', () => {
      const a = 'legal contract obligation'
      const b = 'legal contract termination'
      const sim = contentOverlapSimilarity(a, b)
      expect(sim).toBeGreaterThan(0)
      expect(sim).toBeLessThan(1)
    })

    it('word length filter uses > 3 (not >= 3)', () => {
      // "the" is length 3, should be excluded; "this" is length 4, should be included
      const a = 'this long text only'
      const b = 'this long text only'
      // "this", "long", "text", "only" all have length 4 → included → 1.0
      expect(contentOverlapSimilarity(a, b)).toBe(1.0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // M1: Metadata Filters
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Metadata Filters (M1)', () => {
    const candidates: Record<string, unknown>[] = [
      { id: '1', file_type: 'application/pdf', file_name: 'contract.pdf', created_at: '2024-06-15T10:00:00Z' },
      { id: '2', file_type: 'text/plain', file_name: 'notes.txt', created_at: '2024-07-01T12:00:00Z' },
      { id: '3', file_type: 'application/pdf', file_name: 'Amendment_2024.pdf', created_at: '2024-08-20T08:00:00Z' },
      { id: '4', file_type: 'application/pdf', file_name: 'lease_agreement.pdf', created_at: '2024-05-01T06:00:00Z' },
    ]

    it('fileType filter returns only matching MIME types', () => {
      const result = applyMetadataFilters(candidates, { fileType: 'text/plain' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('fileType filter excludes candidates without file_type', () => {
      const withMissing = [...candidates, { id: '5' }]
      const result = applyMetadataFilters(withMissing, { fileType: 'application/pdf' })
      expect(result.every(c => c.file_type === 'application/pdf')).toBe(true)
      expect(result.find(c => c.id === '5')).toBeUndefined()
    })

    it('fileName ILIKE pattern works with % wildcard', () => {
      const result = applyMetadataFilters(candidates, { fileName: '%agreement%' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('4')
    })

    it('fileName ILIKE is case-insensitive', () => {
      const result = applyMetadataFilters(candidates, { fileName: '%AMENDMENT%' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('3')
    })

    it('fileName ILIKE _ matches single character', () => {
      // "note_.txt" should match "notes.txt"  (_  → any single char)
      const result = applyMetadataFilters(candidates, { fileName: 'note_.txt' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('date range filter uploadedAfter works', () => {
      const result = applyMetadataFilters(candidates, { uploadedAfter: '2024-07-01T00:00:00Z' })
      // Only items strictly after July 1 midnight
      expect(result).toHaveLength(2)
      expect(result.map(c => c.id)).toContain('2') // July 1 12:00 > July 1 00:00
      expect(result.map(c => c.id)).toContain('3') // Aug 20
    })

    it('date range filter uploadedBefore works', () => {
      const result = applyMetadataFilters(candidates, { uploadedBefore: '2024-06-16T00:00:00Z' })
      expect(result).toHaveLength(2)
      expect(result.map(c => c.id)).toContain('1')
      expect(result.map(c => c.id)).toContain('4')
    })

    it('multiple filters combine correctly (AND logic)', () => {
      const result = applyMetadataFilters(candidates, {
        fileType: 'application/pdf',
        uploadedAfter: '2024-06-01T00:00:00Z',
      })
      // PDFs uploaded after June 1: contract.pdf (Jun 15) and Amendment_2024.pdf (Aug 20)
      expect(result).toHaveLength(2)
      expect(result.map(c => c.id)).toEqual(expect.arrayContaining(['1', '3']))
    })

    it('returns all candidates when no filters match any constraint (empty result)', () => {
      const result = applyMetadataFilters(candidates, { fileType: 'image/png' })
      expect(result).toHaveLength(0)
    })

    it('returns all candidates when filters object is empty', () => {
      const result = applyMetadataFilters(candidates, {})
      expect(result).toHaveLength(candidates.length)
    })
  })
})
