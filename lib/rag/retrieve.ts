/**
 * RAG Retrieval Engine
 * 
 * Retrieves relevant document chunks for a query, scoped to a project.
 * Enforces cross-file diversity and token limits.
 */

import { embedText } from './embeddings'
import { supabase } from '@/lib/supabase/server'
import { RAG_CONFIG } from '@/lib/ai/config'
import { logger } from '@/lib/logger'

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
}

export interface RetrievalResult {
    chunks: RetrievedChunk[]
    totalTokens: number
    fileIds: string[]
}

interface RetrievalOptions {
    topK?: number
    maxTokens?: number
    maxChunksPerFile?: number
    /** If set, restrict results to only this file ID */
    fileId?: string
}

const DEFAULTS: Required<RetrievalOptions> = {
    topK: RAG_CONFIG.retrieval.topK,
    maxTokens: RAG_CONFIG.retrieval.maxTokens,
    maxChunksPerFile: RAG_CONFIG.retrieval.maxChunksPerFile,
    fileId: '',
}

/**
 * Retrieve the most relevant document chunks for a query within a project.
 * 
 * Enforces:
 * - Project scope (no cross-project leakage)
 * - File diversity (max N chunks per file)
 * - Token budget (≈3000 tokens total context)
 * - Similarity ordering
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

        // 2. Embed the query
        const queryEmbedding = await embedText(query)

        // 3. Fetch more candidates than needed for diversity filtering
        // If targeting a single file, fetch more candidates from it
        const candidateCount = targetFileId
            ? Math.min(opts.topK * 4, 30)
            : Math.min(opts.topK * 3, 20)

        const { data: candidates, error } = await supabase.rpc('match_file_chunks', {
            query_embedding: JSON.stringify(queryEmbedding),
            match_project_id: projectId,
            match_count: candidateCount,
        })

        if (error) {
            console.error('[RAG Retrieve] RPC error:', error)
            return { chunks: [], totalTokens: 0, fileIds: [] }
        }

        if (!candidates || candidates.length === 0) {
            logger.info("rag/retrieve", `[RAG Retrieve] No chunks found for project ${projectId}`)
            return { chunks: [], totalTokens: 0, fileIds: [] }
        }

        // 4. If a specific file is targeted, filter candidates to only that file
        const filteredCandidates = targetFileId
            ? candidates.filter((c: Record<string, unknown>) => c.file_id === targetFileId)
            : candidates

        if (targetFileId && filteredCandidates.length === 0) {
            logger.info("rag/retrieve", `[RAG Retrieve] No chunks found for file ${targetFileId}, falling back to all candidates`)
        }

        const finalCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates

        // 5. Apply diversity filtering — max N chunks per file
        // If targeting a single file, allow more chunks from it
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
            })

            fileChunkCounts.set(fileId, currentFileCount + 1)
            totalTokens += chunkTokens
        }

        // 4. Fetch file URLs for citation cards
        const fileIds = [...new Set(diverseChunks.map(c => c.fileId))]
        if (fileIds.length > 0) {
            const { data: fileRecords } = await supabase
                .from('files')
                .select('id, url')
                .in('id', fileIds)

            if (fileRecords) {
                const urlMap = new Map(fileRecords.map(f => [f.id, f.url]))
                for (const chunk of diverseChunks) {
                    chunk.fileUrl = urlMap.get(chunk.fileId) || null
                }
            }
        }

        // 5. Log retrieval details
        const duration = Date.now() - startTime
        logger.info("rag/retrieve", 
            `[RAG Retrieve] project=${projectId} | ` +
            `chunks=${diverseChunks.length}/${candidates.length} candidates | ` +
            `files=${fileIds.length} | ` +
            `tokens=${totalTokens} | ` +
            `duration=${duration}ms | ` +
            `file_ids=[${fileIds.join(', ')}] | ` +
            `chunk_indices=[${diverseChunks.map(c => c.chunkIndex).join(', ')}] | ` +
            `similarities=[${diverseChunks.map(c => c.similarity.toFixed(4)).join(', ')}]`
        )

        return { chunks: diverseChunks, totalTokens, fileIds }
    } catch (error) {
        console.error('[RAG Retrieve] Error:', error)
        return { chunks: [], totalTokens: 0, fileIds: [] }
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
        let label = `${chunk.fileName || 'Document'}`
        if (chunk.pageNumber) label += `, Page ${chunk.pageNumber}`
        if (chunk.sectionHeading) label += `, ${chunk.sectionHeading}`

        sections.push(`[${i + 1}] (${label})\n${chunk.content}`)
    }

    return sections.join('\n---\n')
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

4. **DO NOT** include a "Sources" or "References" section — the system adds source cards automatically.

5. **EXAMPLE of correct citation usage:**
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
        console.error('[RAG Retrieve] File reference detection error:', err)
        return null
    }
}

