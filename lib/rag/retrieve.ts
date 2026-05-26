/**
 * RAG Retrieval Engine — Production Upgrade
 * 
 * KEY UPGRADES:
 * - Hybrid search: BM25 full-text + vector cosine with Reciprocal Rank Fusion (RRF)
 * - Similarity threshold: minimum 0.5 (configurable) — no more irrelevant chunks
 * - Chunk adjacency merging: neighboring chunks from same file are merged for coherence
 * - Graceful fallback: if hybrid search RPC is unavailable, falls back to vector-only
 * - C2: Keyword-overlap re-ranking — boosts chunks with more query term matches
 * - H1: HyDE (Hypothetical Document Embeddings) — generates hypothetical answer for better embedding
 * - H2: Conversational context enrichment — recent messages improve follow-up retrieval
 * - M3: In-memory embedding cache — prevents re-embedding identical queries
 * - M6: Retrieval quality metrics — logs search mode, scores, and latency
 */

import { embedText } from './embeddings'
import { supabase } from '@/lib/supabase/server'
import { RAG_CONFIG } from '@/lib/ai/config'
import { logger, logEvent } from '@/lib/logger'

/**
 * M3: Simple in-memory LRU cache for query embeddings.
 * Prevents re-embedding the same query string multiple times.
 * Cache is process-scoped — cleared on server restart.
 */
const EMBEDDING_CACHE_MAX = 200
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>()

function getCachedEmbedding(key: string): number[] | null {
    const entry = embeddingCache.get(key)
    if (!entry) return null
    // Expire after 10 minutes
    if (Date.now() - entry.timestamp > 10 * 60 * 1000) {
        embeddingCache.delete(key)
        return null
    }
    return entry.embedding
}

function setCachedEmbedding(key: string, embedding: number[]): void {
    // Evict oldest entries if cache is full
    if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
        const oldest = embeddingCache.keys().next().value
        if (oldest) embeddingCache.delete(oldest)
    }
    embeddingCache.set(key, { embedding, timestamp: Date.now() })
}

export interface RetrievedChunk {
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
    /** RRF combined score (hybrid search) — may be undefined for vector-only fallback */
    rrfScore?: number
    /** BM25 text rank score — may be undefined for vector-only fallback */
    textRank?: number
}

export interface RetrievalResult {
    chunks: RetrievedChunk[]
    totalTokens: number
    fileIds: string[]
    /** Indicates whether hybrid search was used */
    searchMode: 'hybrid' | 'vector'
}

interface RetrievalOptions {
    topK?: number
    maxTokens?: number
    maxChunksPerFile?: number
    /** Minimum similarity score (0-1). Chunks below this are discarded. Default: 0.5 */
    similarityThreshold?: number
    /** If set, restrict results to only this file ID */
    fileId?: string
    /** Enable/disable adjacency merging. Default: true */
    mergeAdjacentChunks?: boolean
    /** Enable keyword-overlap re-ranking after initial retrieval (C2). Default: true */
    reRank?: boolean
    /** Enable HyDE: generate hypothetical answer before embedding (H1). Default: false — adds latency */
    useHyDE?: boolean
    /** H2: Recent conversation messages for contextual retrieval. Last 2-3 user messages help with follow-ups like "tell me more about that" */
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    /** M1: Metadata filters — applied post-fetch to narrow results by file attributes */
    metadataFilters?: {
        fileType?: string       // filter by file MIME type
        fileName?: string       // filter by filename pattern (ILIKE)
        uploadedAfter?: string  // ISO date — only files uploaded after this date
        uploadedBefore?: string // ISO date
    }
    /** M2: Enable MMR (Maximal Marginal Relevance) diversity re-ordering. Default: false */
    useMMR?: boolean
}

const DEFAULTS: Required<Omit<RetrievalOptions, 'conversationHistory' | 'metadataFilters'>> = {
    topK: RAG_CONFIG.retrieval.topK,
    maxTokens: RAG_CONFIG.retrieval.maxTokens,
    maxChunksPerFile: RAG_CONFIG.retrieval.maxChunksPerFile,
    similarityThreshold: 0.5,
    fileId: '',
    mergeAdjacentChunks: true,
    reRank: true,
    useHyDE: false,
    useMMR: false,
}

/**
 * Retrieve the most relevant document chunks for a query within a project.
 * 
 * Uses hybrid search (BM25 + vector + RRF) when available, with graceful
 * fallback to vector-only search if the hybrid RPC hasn't been deployed.
 * 
 * Enforces:
 * - Project scope (no cross-project leakage)
 * - Similarity threshold (configurable, default 0.5)
 * - File diversity (max N chunks per file)
 * - Token budget (≈3000 tokens total context)
 * - Chunk adjacency merging (neighboring chunks from same file)
 */
export async function retrieveRelevantChunks(
    projectId: string,
    query: string,
    options?: RetrievalOptions
): Promise<RetrievalResult> {
    const opts = { ...DEFAULTS, ...options }
    const startTime = Date.now()

    try {
        // 1. Detect if the query references a specific file by name
        const targetFileId = (opts.fileId || '') || await detectFileReference(projectId, query)
        if (targetFileId) {
            logger.info("rag/retrieve", `[RAG Retrieve] Detected file reference → filtering to file ${targetFileId}`)
        }

        // 2. Build enriched query with conversational context (H2)
        let embeddingInput = query
        if (options?.conversationHistory && options.conversationHistory.length > 0) {
            // Take last 3 user messages for context (avoid diluting with too much history)
            const recentUserMsgs = options.conversationHistory
                .filter(m => m.role === 'user')
                .slice(-3)
                .map(m => m.content.slice(0, 200))
            if (recentUserMsgs.length > 0) {
                embeddingInput = `${recentUserMsgs.join(' ')} ${query}`
            }
        }

        // 3. Optionally expand with HyDE
        if (opts.useHyDE) {
            try {
                embeddingInput = await hydeExpandQuery(query)
                logger.info("rag/retrieve", `[RAG HyDE] Expanded query: "${query.slice(0, 50)}..." → ${embeddingInput.length} chars`)
            } catch {
                logger.info("rag/retrieve", '[RAG HyDE] Expansion failed, using original query')
            }
        }

        // 4. Embed the query (M3: use cache to avoid re-embedding identical queries)
        let queryEmbedding = getCachedEmbedding(embeddingInput)
        if (!queryEmbedding) {
            queryEmbedding = await embedText(embeddingInput)
            setCachedEmbedding(embeddingInput, queryEmbedding)
        }

        // 3. Fetch candidates — try hybrid first, fallback to vector-only
        // With re-ranking (C2), fetch more candidates initially then re-rank down
        const reRankMultiplier = opts.reRank ? 3 : 1
        const candidateCount = targetFileId
            ? Math.min(opts.topK * 4 * reRankMultiplier, 50)
            : Math.min(opts.topK * 3 * reRankMultiplier, 30)

        let candidates: Record<string, unknown>[] | null = null
        let searchMode: 'hybrid' | 'vector' = 'hybrid'

        // Try hybrid search first
        try {
            const { data, error } = await supabase.rpc('match_file_chunks_hybrid', {
                query_embedding: JSON.stringify(queryEmbedding),
                query_text: query,
                match_project_id: projectId,
                match_count: candidateCount,
                similarity_threshold: opts.similarityThreshold,
            })

            if (!error && data && data.length > 0) {
                candidates = data
                searchMode = 'hybrid'
            } else if (error) {
                logger.info("rag/retrieve", `[RAG Retrieve] Hybrid search unavailable (${error.message}), falling back to vector-only`)
            }
        } catch {
            logger.info("rag/retrieve", '[RAG Retrieve] Hybrid search not available, using vector-only fallback')
        }

        // Fallback to vector-only search
        if (!candidates) {
            searchMode = 'vector'
            const { data, error } = await supabase.rpc('match_file_chunks', {
                query_embedding: JSON.stringify(queryEmbedding),
                match_project_id: projectId,
                match_count: candidateCount,
            })

            if (error) {
                logger.error('[RAG Retrieve] RPC error:', 'Error occurred', error)
                return { chunks: [], totalTokens: 0, fileIds: [], searchMode: 'vector' }
            }

            candidates = data || []
        }

        if (!candidates || candidates.length === 0) {
            logger.info("rag/retrieve", `[RAG Retrieve] No chunks found for project ${projectId}`)
            return { chunks: [], totalTokens: 0, fileIds: [], searchMode }
        }

        // 4. Apply similarity threshold (for vector-only fallback — hybrid already filters)
        if (searchMode === 'vector') {
            candidates = candidates.filter(
                (c: Record<string, unknown>) => (c.similarity as number) >= opts.similarityThreshold
            )
        }

        // 5. If a specific file is targeted, filter candidates to only that file
        const filteredCandidates = targetFileId
            ? candidates.filter((c: Record<string, unknown>) => c.file_id === targetFileId)
            : candidates

        if (targetFileId && filteredCandidates.length === 0) {
            logger.info("rag/retrieve", `[RAG Retrieve] No chunks found for file ${targetFileId}, falling back to all candidates`)
        }

        let finalCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates

        // 6a. M1: Apply metadata filters if provided
        if (options?.metadataFilters) {
            finalCandidates = applyMetadataFilters(finalCandidates, options.metadataFilters)
        }

        // 6b. Apply diversity filtering — max N chunks per file
        const effectiveMaxPerFile = targetFileId ? opts.topK : opts.maxChunksPerFile
        const fileChunkCounts = new Map<string, number>()
        const diverseChunks: RetrievedChunk[] = []
        let totalTokens = 0

        for (const candidate of finalCandidates) {
            if (diverseChunks.length >= opts.topK) break
            if (totalTokens >= opts.maxTokens) break

            const fileId = candidate.file_id as string
            const currentFileCount = fileChunkCounts.get(fileId) || 0

            if (currentFileCount >= effectiveMaxPerFile) continue

            const chunkTokens = candidate.token_count as number
            if (totalTokens + chunkTokens > opts.maxTokens) continue

            diverseChunks.push({
                id: candidate.id as string,
                fileId,
                fileName: candidate.file_name as string | null,
                fileUrl: null, // populated below
                content: candidate.content as string,
                tokenCount: chunkTokens,
                chunkIndex: candidate.chunk_index as number,
                similarity: candidate.similarity as number,
                pageNumber: candidate.page_number as number | null,
                sectionHeading: candidate.section_heading as string | null,
                rrfScore: (candidate.rrf_score as number) || undefined,
                textRank: (candidate.text_rank as number) || undefined,
            })

            fileChunkCounts.set(fileId, currentFileCount + 1)
            totalTokens += chunkTokens
        }

        // 7. Re-rank chunks using keyword overlap (C2)
        const reRankedChunks = opts.reRank
            ? reRankChunks(diverseChunks, query)
            : diverseChunks

        // 7a. M2: Apply MMR diversity re-ordering after re-ranking, before adjacency merging
        const mmrChunks = opts.useMMR
            ? applyMMR(reRankedChunks, queryEmbedding, 0.7)
            : reRankedChunks

        // 8. Merge adjacent chunks from same file for coherence
        const mergedChunks = opts.mergeAdjacentChunks
            ? mergeAdjacentChunks(mmrChunks)
            : mmrChunks

        // 8. Recalculate total tokens after merging
        totalTokens = mergedChunks.reduce((sum, c) => sum + c.tokenCount, 0)

        // 9. Fetch file URLs for citation cards
        const fileIds = [...new Set(mergedChunks.map(c => c.fileId))]
        if (fileIds.length > 0) {
            const { data: fileRecords } = await supabase
                .from('files')
                .select('id, url')
                .in('id', fileIds)

            if (fileRecords) {
                const urlMap = new Map(fileRecords.map(f => [f.id, f.url]))
                for (const chunk of mergedChunks) {
                    chunk.fileUrl = urlMap.get(chunk.fileId) || null
                }
            }
        }

        // 10. Log retrieval details
        const duration = Date.now() - startTime
        logger.info("rag/retrieve",
            `[RAG Retrieve] project=${projectId} | ` +
            `mode=${searchMode} | ` +
            `chunks=${mergedChunks.length}/${candidates.length} candidates | ` +
            `files=${fileIds.length} | ` +
            `tokens=${totalTokens} | ` +
            `duration=${duration}ms | ` +
            `similarities=[${mergedChunks.map(c => c.similarity.toFixed(4)).join(', ')}]` +
            (searchMode === 'hybrid' ? ` | rrf=[${mergedChunks.map(c => (c.rrfScore || 0).toFixed(4)).join(', ')}]` : '')
        )

        // M6: Log structured retrieval quality metrics for observability
        logEvent('RAG_RETRIEVE', {
            projectId,
            searchMode,
            candidateCount: candidates.length,
            returnedChunks: mergedChunks.length,
            uniqueFiles: fileIds.length,
            totalTokens,
            durationMs: duration,
            avgSimilarity: mergedChunks.length > 0
                ? Math.round(mergedChunks.reduce((sum, c) => sum + c.similarity, 0) / mergedChunks.length * 1000) / 1000
                : 0,
            minSimilarity: mergedChunks.length > 0
                ? Math.round(Math.min(...mergedChunks.map(c => c.similarity)) * 1000) / 1000
                : 0,
            maxSimilarity: mergedChunks.length > 0
                ? Math.round(Math.max(...mergedChunks.map(c => c.similarity)) * 1000) / 1000
                : 0,
            useHyDE: opts.useHyDE,
            reRanked: opts.reRank,
            embeddingCacheSize: embeddingCache.size,
        })

        return { chunks: mergedChunks, totalTokens, fileIds, searchMode }
    } catch (error) {
        logger.error('[RAG Retrieve] Error:', 'Error occurred', error)
        return { chunks: [], totalTokens: 0, fileIds: [], searchMode: 'vector' }
    }
}

/**
 * Merge adjacent chunks from the same file to provide more coherent context.
 * 
 * If chunks with indices N and N+1 from the same file are both retrieved,
 * they're combined into a single chunk with merged content.
 */
function mergeAdjacentChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
    if (chunks.length <= 1) return chunks

    // Group chunks by file
    const byFile = new Map<string, RetrievedChunk[]>()
    for (const chunk of chunks) {
        const existing = byFile.get(chunk.fileId) || []
        existing.push(chunk)
        byFile.set(chunk.fileId, existing)
    }

    const merged: RetrievedChunk[] = []

    for (const [, fileChunks] of byFile) {
        // Sort by chunk index within each file
        fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

        let current = { ...fileChunks[0] }

        for (let i = 1; i < fileChunks.length; i++) {
            const next = fileChunks[i]

            // If this chunk is adjacent (index differs by 1), merge
            if (next.chunkIndex === current.chunkIndex + 1) {
                current = {
                    ...current,
                    content: current.content + '\n\n' + next.content,
                    tokenCount: current.tokenCount + next.tokenCount,
                    // Track the latest chunkIndex so consecutive merges chain correctly
                    chunkIndex: next.chunkIndex,
                    // Keep the higher similarity score
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

    // Re-sort by similarity (or RRF score if available) after merging
    merged.sort((a, b) => {
        if (a.rrfScore && b.rrfScore) return b.rrfScore - a.rrfScore
        return b.similarity - a.similarity
    })

    return merged
}

/**
 * M1: Apply metadata filters to candidates after fetching.
 * Filters based on file type, filename pattern, and upload dates.
 */
function applyMetadataFilters(
    candidates: Record<string, unknown>[],
    filters: NonNullable<RetrievalOptions['metadataFilters']>
): Record<string, unknown>[] {
    return candidates.filter(candidate => {
        // Filter by file MIME type
        if (filters.fileType) {
            const candidateType = candidate.file_type as string | undefined
            if (!candidateType || candidateType !== filters.fileType) return false
        }

        // Filter by filename pattern (case-insensitive LIKE)
        if (filters.fileName) {
            const candidateName = candidate.file_name as string | undefined
            if (!candidateName) return false
            // Convert SQL ILIKE pattern (% as wildcard) to a regex
            const pattern = filters.fileName
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex chars
                .replace(/%/g, '.*')                      // SQL % → regex .*
                .replace(/_/g, '.')                        // SQL _ → regex .
            const regex = new RegExp(`^${pattern}$`, 'i')
            if (!regex.test(candidateName)) return false
        }

        // Filter by upload date — after
        if (filters.uploadedAfter) {
            const uploadedAt = candidate.created_at as string | undefined
            if (!uploadedAt || new Date(uploadedAt) <= new Date(filters.uploadedAfter)) return false
        }

        // Filter by upload date — before
        if (filters.uploadedBefore) {
            const uploadedAt = candidate.created_at as string | undefined
            if (!uploadedAt || new Date(uploadedAt) >= new Date(filters.uploadedBefore)) return false
        }

        return true
    })
}


/**
 * M2: Maximal Marginal Relevance (MMR) diversity scoring.
 *
 * Re-orders chunks to balance relevance to the query and diversity among
 * selected chunks. Higher λ favors relevance, lower λ favors diversity.
 *
 * MMR(d) = λ * sim(d, q) - (1-λ) * max_selected(sim(d, s))
 */
function applyMMR(
    chunks: RetrievedChunk[],
    queryEmbedding: number[],
    lambda: number = 0.7
): RetrievedChunk[] {
    if (chunks.length <= 1) return chunks

    // We need embeddings for each chunk to compute inter-chunk similarity.
    // Since we only have similarity scores (not raw embeddings for each chunk),
    // we approximate using content-based cosine similarity via a simple TF vector.
    // However, the chunks already have a .similarity score to the query.

    const remaining = [...chunks]
    const selected: RetrievedChunk[] = []

    // Pick the most relevant chunk first
    remaining.sort((a, b) => b.similarity - a.similarity)
    selected.push(remaining.shift()!)

    while (remaining.length > 0) {
        let bestIdx = 0
        let bestMMR = -Infinity

        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i]

            // Relevance: similarity to query (already computed)
            const relevance = candidate.similarity

            // Diversity penalty: max similarity to any already-selected chunk
            // We use content word-overlap as a proxy since we don't have chunk embeddings
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

/**
 * Content-based overlap similarity between two text strings.
 * Returns a value in [0, 1] using Jaccard similarity of significant words.
 */
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

/**
 * C2: Keyword-overlap re-ranking.
 * 
 * After initial retrieval (vector/hybrid), re-scores chunks by how many
 * query terms they contain. This catches cases where the embedding retrieves
 * semantically related but factually irrelevant chunks.
 * 
 * Scoring:
 * - Exact query term match: +2
 * - Bi-gram (two consecutive words) match: +3 (stronger signal)
 * - Section heading match: +2 bonus
 * - Final score = original_similarity * (1 + keyword_boost * 0.1)
 */
function reRankChunks(chunks: RetrievedChunk[], query: string): RetrievedChunk[] {
    if (chunks.length <= 1) return chunks

    const queryLower = query.toLowerCase()
    const queryWords = queryLower
        .replace(/[^\w\s'-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)

    // Build bi-grams from query
    const queryBigrams: string[] = []
    for (let i = 0; i < queryWords.length - 1; i++) {
        queryBigrams.push(`${queryWords[i]} ${queryWords[i + 1]}`)
    }

    const scored = chunks.map(chunk => {
        const contentLower = chunk.content.toLowerCase()
        let keywordScore = 0

        // Score individual term matches
        for (const word of queryWords) {
            // Count occurrences (cap at 3 to avoid gaming)
            const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
            const matches = contentLower.match(regex)
            if (matches) {
                keywordScore += Math.min(matches.length, 3) * 2
            }
        }

        // Score bi-gram matches (stronger signal)
        for (const bigram of queryBigrams) {
            if (contentLower.includes(bigram)) {
                keywordScore += 3
            }
        }

        // Bonus for section heading match
        if (chunk.sectionHeading) {
            const headingLower = chunk.sectionHeading.toLowerCase()
            for (const word of queryWords) {
                if (headingLower.includes(word)) {
                    keywordScore += 2
                }
            }
        }

        // Combine: base similarity boosted by keyword score
        const boost = 1 + (keywordScore * 0.1)
        const reRankedSimilarity = chunk.similarity * Math.min(boost, 2.0) // cap at 2x

        return { chunk, reRankedSimilarity, keywordScore }
    })

    // Sort by re-ranked similarity
    scored.sort((a, b) => b.reRankedSimilarity - a.reRankedSimilarity)

    return scored.map(s => ({
        ...s.chunk,
        similarity: s.reRankedSimilarity,
    }))
}

/**
 * H1: HyDE — Hypothetical Document Embeddings.
 * 
 * Generates a brief hypothetical answer to the user's query, then
 * returns that as the embedding input. This produces embeddings that
 * are closer to the actual document content in vector space.
 * 
 * Most effective for abstract queries like "what are the risks?" where
 * the query itself doesn't overlap well with document language.
 */
async function hydeExpandQuery(query: string): Promise<string> {
    try {
        const { callAISafe } = await import('@/lib/ai/client')

        const { result } = await callAISafe('chat' as Parameters<typeof callAISafe>[0], {
            text: query,
        }, {
            maxTokens: 200,
            temperature: 0.3,
            systemOverride: 'You are a legal document assistant. Given a user question, write a brief 2-3 sentence hypothetical passage that would appear in a legal document to answer this question. Write it as if quoting from the document itself, not as a response to the user. Be specific and use legal terminology.',
            userOverride: query,
        })

        if (result && result.length > 20) {
            // Combine original query + hypothetical for dual-signal embedding
            return `${query}\n\n${result}`
        }
        return query
    } catch {
        return query
    }
}

/**
 * Build a formatted context block from retrieved chunks for injection into prompts.
 * Each chunk is numbered [1], [2], etc. for citation in the AI response.
 */
export function buildRAGContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return ''

    const sections: string[] = []

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const num = i + 1

        // Build structured header with explicit metadata
        const headerLines = [`[SOURCE_${num}]`]
        headerLines.push(`Document: ${chunk.fileName || 'Document'}`)
        if (chunk.pageNumber) headerLines.push(`Page: ${chunk.pageNumber}`)
        if (chunk.sectionHeading) headerLines.push(`Section: "${chunk.sectionHeading}"`)
        headerLines.push(`Chunk: ${chunk.chunkIndex + 1}`)
        headerLines.push('---')

        sections.push(`${headerLines.join('\n')}\n${chunk.content}\n[/SOURCE_${num}]`)
    }

    return sections.join('\n\n')
}

/**
 * Build a <!--SOURCES: block from retrieved chunks matching the exact format
 * used by web search, so the frontend renders them as hoverable citation cards.
 * 
 * Uses in-app URLs: /documents/document/{fileId}?ci={chunkIndex}
 * so clicking a citation navigates to the document viewer with highlighting.
 */
export function buildRAGSourcesBlock(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return ''

    const lines: string[] = []

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        // Build a descriptive title
        let title = chunk.fileName || 'Document'
        if (chunk.pageNumber) title += ` — Page ${chunk.pageNumber}`
        if (chunk.sectionHeading) title += ` — ${chunk.sectionHeading}`

        // Use in-app document viewer URL with chunk index for highlighting, or a generic URL for temp uploaded files
        const url = chunk.fileId.startsWith('upload-')
            ? `https://upload.local/file/${encodeURIComponent(chunk.fileId)}`
            : `https://documents.app/document/${chunk.fileId}?ci=${chunk.chunkIndex}`

        // Snippet: first ~800 chars of content, cleaned
        const snippet = chunk.content.replace(/\r?\n/g, ' ').substring(0, 800)

        lines.push(`[${i + 1}] ${title} | ${url} | ${snippet}`)
    }

    if (lines.length === 0) return ''

    return `\n\n<!--SOURCES:\n${lines.join('\n')}\n-->`
}

/**
 * Build a <!--SOURCES: block dynamically based on the AI's response.
 * It selects the snippet from each chunk that has the most word overlap with the AI's response,
 * ensuring the frontend highlights the most relevant passage.
 */
export function buildDynamicRAGSourcesBlock(chunks: RetrievedChunk[], responseText: string): string {
    if (chunks.length === 0) return ''

    const lines: string[] = []

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        let title = chunk.fileName || 'Document'
        if (chunk.pageNumber) title += ` — Page ${chunk.pageNumber}`
        if (chunk.sectionHeading) title += ` — ${chunk.sectionHeading}`

        const url = chunk.fileId.startsWith('upload-')
            ? `https://upload.local/file/${encodeURIComponent(chunk.fileId)}`
            : `https://documents.app/document/${chunk.fileId}?ci=${chunk.chunkIndex}`

        let bestSnippet = chunk.content.substring(0, 800)

        // Find where this specific chunk was cited in the response " [i+1]"
        const citMarker = `[${i + 1}]`
        const markerIdx = responseText.indexOf(citMarker)
        
        // Extract the context immediately BEFORE the citation if marker exists.
        // If not, use the entire response text as context to find the best snippet.
        let precedingText = responseText
        if (markerIdx !== -1) {
            const startIdx = Math.max(0, markerIdx - 400)
            precedingText = responseText.substring(startIdx, markerIdx)
        }
        
        const aiWords = new Set(
            precedingText.toLowerCase()
                .replace(/[^\w\s'-]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 3) // catch more context
        )
        
        // Split chunk into sentences for much finer granularity
        // Handles legal docs with massive paragraphs by isolating the specific relevant sentence.
        const sentences = chunk.content.match(/[^.!?]+(?:[.!?]+|$)/g) || [chunk.content]
        
        let maxOverlap = -1
        let bestSentenceIdx = 0
        
        for (let s = 0; s < sentences.length; s++) {
            const sentenceText = sentences[s].trim()
            if (sentenceText.length < 10) continue

            const sWords = new Set(
                sentenceText.toLowerCase()
                    .replace(/[^\w\s'-]/g, ' ')
                    .split(/\s+/)
                    .filter(w => w.length > 3)
            )
            
            let overlap = 0
            if (aiWords.size > 0) {
                for (const w of sWords) {
                    if (aiWords.has(w)) overlap++
                }
            }
            
            // Prefer the later sentence if overlap is identical to prioritize deep chunk matches rather than first sentence
            if (overlap > maxOverlap || (overlap === maxOverlap && overlap > 0)) {
                maxOverlap = overlap
                bestSentenceIdx = s
            }
        }
        
        // Gather context starting slightly before the best sentence, or at the best sentence
        let gatheredSnippet = ""
        let currentS = Math.max(0, bestSentenceIdx - 1) // include 1 preceding sentence for context
        
        while (gatheredSnippet.length < 800 && currentS < sentences.length) {
            gatheredSnippet += sentences[currentS].trim() + " "
            currentS++
        }
        
        bestSnippet = gatheredSnippet.trim().substring(0, 800)

        const snippet = bestSnippet.replace(/\r?\n/g, ' ').substring(0, 800).trim()

        lines.push(`[${i + 1}] ${title} | ${url} | ${snippet}`)
    }

    if (lines.length === 0) return ''

    return `\n\n<!--SOURCES:\n${lines.join('\n')}\n-->`
}

/**
 * System instruction for RAG-grounded responses.
 * Uses inline [N] citations that the frontend renders as hoverable cards.
 */
export const RAG_GROUNDING_INSTRUCTION = `You are Wesley, a legal AI assistant with access to specific project documents.

**CRITICAL FORMATTING RULES — YOU MUST FOLLOW ALL OF THESE:**

1. **INLINE CITATIONS ARE MANDATORY.** You MUST place numbered citations like [1], [2], [3] IMMEDIATELY after EVERY sentence or claim that references a document. The numbers correspond to the numbered document excerpts provided in the context. NEVER skip this — every factual statement needs a citation.

2. **DETAILED RESPONSES REQUIRED.** Provide thorough, comprehensive analysis. Include:
   - Complete summaries of key provisions and terms
   - All relevant parties and their roles
   - Important dates, deadlines, and financial terms
   - Legal implications and notable clauses
   - Organize with clear headings and bullet points

3. **GROUNDING RULES:**
   - Base your response primarily on the provided document excerpts
   - You may use your legal knowledge to explain, contextualize, and elaborate on the document content
   - If the documents don't contain information to answer the question, say so clearly
   - Do NOT fabricate document content

4. **DO NOT** include a "Sources", "References", or citation summary section at the end. The system automatically generates source cards from your [N] markers. Never output any source metadata block.

5. **ONLY use [N] markers that match the numbered excerpts you were given.** Do not invent citation numbers beyond what was provided.

6. **EXAMPLE of correct citation usage:**
   "The agreement was executed on February 11, 2013 [1], between SUDAM Diamonds Ltd. and Americas Diamond Corp. [2]. The purchase price is set at $1.00 per share [1], with closing contingent upon satisfaction of certain conditions [3]."

Remember: EVERY factual claim MUST have a [N] citation. Write detailed, thorough responses.`

/**
 * Post-process AI response to inject citation markers if the model didn't generate them.
 * Uses keyword overlap between the response text and RAG chunk content.
 */
export function ensureCitationMarkers(text: string, chunks: RetrievedChunk[]): string {
    // Skip if text already contains citation markers
    if (/\[\d+\]/.test(text)) return text
    if (chunks.length === 0 || !text) return text

    // Build keyword sets for each chunk (significant words > 4 chars)
    const chunkWords = chunks.map(c => {
        const words = c.content.toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 4)
        return new Set(words)
    })

    const lines = text.split('\n')
    let citationsAdded = false

    const result = lines.map(line => {
        const trimmed = line.trim()
        // Skip short lines, headers, empty lines, list markers
        if (!trimmed || trimmed.length < 40 || /^#{1,6}\s/.test(trimmed)) return line
        // Skip lines that are just formatting
        if (/^\*\*[^*]+\*\*\s*$/.test(trimmed)) return line

        const lineWords = trimmed.toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 4)

        if (lineWords.length < 3) return line

        const matchingChunks: number[] = []
        for (let i = 0; i < chunkWords.length; i++) {
            let matches = 0
            for (const w of lineWords) {
                if (chunkWords[i].has(w)) matches++
            }
            // Need at least 3 matching significant words
            if (matches >= 3) matchingChunks.push(i + 1)
        }

        if (matchingChunks.length > 0) {
            citationsAdded = true
            const markers = [...new Set(matchingChunks)].slice(0, 2).map(n => `[${n}]`).join('')
            // Add markers at the end of the line
            const cleaned = line.trimEnd()
            if (cleaned.endsWith('.')) {
                return cleaned.slice(0, -1) + ' ' + markers + '.'
            }
            return cleaned + ' ' + markers
        }
        return line
    })

    return citationsAdded ? result.join('\n') : text
}

/**
 * Detect if a user's query references a specific file by name.
 * Uses fuzzy matching with discriminating-word bias: words that are unique
 * to a specific file (e.g., "americas", "diamond") are weighted higher
 * than words shared across many files (e.g., "law", "insider").
 * 
 * Returns the file_id if a confident match is found, null otherwise.
 */
async function detectFileReference(
    projectId: string,
    query: string
): Promise<string | null> {
    try {
        // Fetch all file names for the project
        const { data: files, error } = await supabase
            .from('files')
            .select('id, name')
            .eq('project_id', projectId)

        if (error || !files || files.length <= 1) return null

        const queryLower = query.toLowerCase()

        // Step 1: Extract words from each file name
        const fileWordSets: { fileId: string; name: string; words: string[] }[] = []
        const wordFrequency = new Map<string, number>() // how many files contain each word

        for (const file of files) {
            if (!file.name) continue
            const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
            const words = nameWithoutExt
                .toLowerCase()
                .replace(/[_\-\.]/g, ' ')
                .split(/\s+/)
                .filter((w: string) => w.length > 2)

            fileWordSets.push({ fileId: file.id, name: file.name, words })
            
            // Count word frequency across files (for discriminating-word detection)
            const uniqueWords = new Set<string>(words)
            for (const w of uniqueWords) {
                wordFrequency.set(w, (wordFrequency.get(w) || 0) + 1)
            }
        }

        // Step 2: Score each file based on matching words, weighting discriminating words higher
        const totalFiles = files.length
        let bestMatch: { fileId: string; name: string; score: number; matchedWords: string[] } | null = null

        for (const { fileId, name, words } of fileWordSets) {
            if (words.length === 0) continue

            let weightedScore = 0
            const matchedWords: string[] = []

            for (const word of words) {
                if (queryLower.includes(word)) {
                    matchedWords.push(word)

                    // Weight: discriminating words count more
                    // If a word appears in all files, weight = 0.5
                    // If a word is unique to this file, weight = 2.0
                    const freq = wordFrequency.get(word) || 1
                    const weight = freq >= totalFiles 
                        ? 0.5  // common word (in all files)
                        : freq >= totalFiles * 0.5 
                            ? 1.0  // semi-common word
                            : 2.0  // discriminating word (unique or rare)
                    
                    weightedScore += weight
                }
            }

            logger.info("rag/retrieve", `[RAG Detect] File "${name}": matched=[${matchedWords.join(', ')}], weightedScore=${weightedScore.toFixed(1)}, totalWords=${words.length}`)

            // Need at least 2 matching words total, with meaningful weighted score
            if (matchedWords.length >= 2 && weightedScore >= 2.0) {
                if (!bestMatch || weightedScore > bestMatch.score) {
                    bestMatch = { fileId, name, score: weightedScore, matchedWords }
                }
            }
        }

        if (bestMatch) {
            // Only accept if the best match is significantly better than the second best
            let secondBest = 0
            for (const { fileId: fId, words: fWords } of fileWordSets) {
                if (fId === bestMatch.fileId) continue
                let ws = 0
                for (const word of fWords) {
                    if (queryLower.includes(word)) {
                        const freq = wordFrequency.get(word) || 1
                        ws += freq >= totalFiles ? 0.5 : freq >= totalFiles * 0.5 ? 1.0 : 2.0
                    }
                }
                secondBest = Math.max(secondBest, ws)
            }

            // Best match must be at least 1.5x better than runner-up
            if (secondBest > 0 && bestMatch.score / secondBest < 1.5) {
                logger.info("rag/retrieve", `[RAG Detect] Ambiguous: best=${bestMatch.score.toFixed(1)}, secondBest=${secondBest.toFixed(1)}, skipping filter`)
                return null
            }

            logger.info("rag/retrieve", `[RAG Detect] Winner: "${bestMatch.name}" (score=${bestMatch.score.toFixed(1)}, words=[${bestMatch.matchedWords.join(', ')}])`)
            return bestMatch.fileId
        }

        return null
    } catch (err) {
        logger.error('[RAG Retrieve] File reference detection error:', 'Error occurred', err)
        return null
    }
}
