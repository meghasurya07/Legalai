/**
 * RAG Retrieval Engine
 * 
 * Retrieves relevant document chunks for a query, scoped to a project.
 * Enforces cross-file diversity and token limits.
 */

import { embedText } from './embeddings'
import { supabase } from '@/lib/supabase/server'
import { RAG_CONFIG } from '@/lib/ai/config'

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
}

const DEFAULTS: Required<RetrievalOptions> = {
    topK: RAG_CONFIG.retrieval.topK,
    maxTokens: RAG_CONFIG.retrieval.maxTokens,
    maxChunksPerFile: RAG_CONFIG.retrieval.maxChunksPerFile,
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
        // 1. Embed the query
        const queryEmbedding = await embedText(query)

        // 2. Fetch more candidates than needed for diversity filtering
        const candidateCount = Math.min(opts.topK * 3, 20)

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
            console.log(`[RAG Retrieve] No chunks found for project ${projectId}`)
            return { chunks: [], totalTokens: 0, fileIds: [] }
        }

        // 3. Apply diversity filtering — max N chunks per file
        const fileChunkCounts = new Map<string, number>()
        const diverseChunks: RetrievedChunk[] = []
        let totalTokens = 0

        for (const candidate of candidates) {
            if (diverseChunks.length >= opts.topK) break
            if (totalTokens >= opts.maxTokens) break

            const fileId = candidate.file_id as string
            const currentFileCount = fileChunkCounts.get(fileId) || 0

            if (currentFileCount >= opts.maxChunksPerFile) continue

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
        console.log(
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

    const seen = new Set<string>()
    const lines: string[] = []

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        // Build a descriptive title
        let title = chunk.fileName || 'Document'
        if (chunk.pageNumber) title += ` — Page ${chunk.pageNumber}`
        if (chunk.sectionHeading) title += ` — ${chunk.sectionHeading}`

        // Use in-app document viewer URL with chunk index for highlighting
        const url = `https://documents.app/document/${chunk.fileId}?ci=${chunk.chunkIndex}`

        // Deduplicate by fileId+chunkIndex 
        const key = `${chunk.fileId}#${chunk.chunkIndex}`
        if (seen.has(key)) continue
        seen.add(key)

        // Snippet: first ~200 chars of content, cleaned
        const snippet = chunk.content.replace(/\r?\n/g, ' ').substring(0, 200)

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

**MANDATORY RULES:**
1. Answer ONLY using the provided project document context below.
2. Use inline numbered citations [1], [2], [3] throughout your response to reference the source documents. Place these IMMEDIATELY after the relevant sentence or claim. These numbers correspond to the numbered document excerpts provided in the context.
3. Do NOT include a "Sources" or "References" section at the end — the system handles source display automatically.
4. If the provided documents do not contain sufficient information to answer the question, explicitly state: "The uploaded project documents do not contain sufficient information to answer this question. Please upload relevant documents or rephrase your query."
5. Do NOT fabricate, hallucinate, or use external knowledge beyond what is in the provided documents.
6. If only partial information is available, state what the documents do cover and what is missing.
7. Every factual claim MUST have a citation.`

