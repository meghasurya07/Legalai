import { supabase } from '@/lib/supabase/server'
import { retrieveRelevantChunks, buildRAGContext, buildRAGSourcesBlock, RAG_GROUNDING_INSTRUCTION, type RetrievedChunk } from '@/lib/rag'
import { retrieveMemories, assembleMemoryContext, buildMemoryAttribution } from '@/lib/memory'
import type { MemoryRetrievalResult } from '@/lib/memory'
import { logger } from '@/lib/logger'

interface AttachedFile {
    id?: string
    name: string
    content?: string
    [key: string]: unknown
}

export interface ChatContext {
    userContent: string
    ragContext: string
    ragSystemMessage: string
    ragSourcesBlock: string
    ragChunks: RetrievedChunk[]
    memoryContextText: string
    memoryAttributionText: string
    usedMemories: MemoryRetrievalResult[]
}

/**
 * Build the full context for a chat message, including:
 * - RAG document context from the project
 * - Memory intelligence
 * - Inline file content from user uploads
 */
export async function buildChatContext(
    message: string,
    projectId: string | null | undefined,
    userId: string,
    files?: AttachedFile[]
): Promise<ChatContext> {
    let userContent = message || ''
    let ragContext = ''
    let ragSystemMessage = ''
    let ragSourcesBlock = ''
    let ragChunks: RetrievedChunk[] = []
    let memoryContextText = ''
    let memoryAttributionText = ''
    let usedMemories: MemoryRetrievalResult[] = []

    // 1. RAG Context Injection from Project Documents
    if (projectId) {
        try {
            const retrieval = await retrieveRelevantChunks(projectId, userContent)
            if (retrieval.chunks.length > 0) {
                ragContext = buildRAGContext(retrieval.chunks)
                ragSystemMessage = RAG_GROUNDING_INSTRUCTION
                ragSourcesBlock = buildRAGSourcesBlock(retrieval.chunks)
                ragChunks = retrieval.chunks
            } else {
                // Fallback: if no chunks exist (e.g. migration not run yet), use legacy approach
                userContent = await appendLegacyProjectContext(userContent, projectId)
            }
        } catch (ragError) {
            logger.error('context-builder', 'RAG retrieval error, falling back to legacy', ragError)
            userContent = await appendLegacyProjectContext(userContent, projectId)
        }
    }

    // 2. Memory Intelligence Retrieval
    if (projectId) {
        try {
            const memoryResult = await retrieveMemories({
                query: message || '',
                projectId,
                organizationId: undefined,
                userId,
                blockedProjectIds: [],
            })

            if (memoryResult.results.length > 0) {
                const memContext = assembleMemoryContext(
                    memoryResult.results.filter(m => m.retrieval_path !== 'structured' || m.memory_type !== 'preference'),
                    [],  // Firm patterns — Phase 5
                    memoryResult.results.filter(m => m.memory_type === 'preference')
                )
                memoryContextText = memContext.formatted_text
                memoryAttributionText = buildMemoryAttribution()
                usedMemories = memoryResult.results
                logger.info("context-builder", `[Memory] Retrieved ${memoryResult.results.length} memories (V:${memoryResult.pathStats.vector} G:${memoryResult.pathStats.graph} S:${memoryResult.pathStats.structured})`)
            }
        } catch (memError) {
            logger.warn('context-builder', 'Memory retrieval failed (non-blocking)', memError)
        }
    }

    // 3. Process attached files into pseudo-chunks
    if (files && files.length > 0) {
        const fileNames = files.map((f: AttachedFile) => typeof f === 'string' ? f : f.name).join(', ')
        userContent += `\n\n[User uploaded files in this message: ${fileNames}]`

        const pseudoChunks: RetrievedChunk[] = []
        files.forEach((f: AttachedFile, index: number) => {
            if (typeof f === 'object' && f.content && typeof f.content === 'string') {
                const rawContent = f.content.slice(0, 100000)
                const words = rawContent.split(/\s+/)
                let currentChunk = ''
                let chunkIndex = 0

                const fileId = f.id ? String(f.id) : `upload-${index}`

                for (const w of words) {
                    if (currentChunk.length + w.length > 800 && currentChunk.length > 0) {
                        pseudoChunks.push({
                            id: `${fileId}-${chunkIndex}`,
                            fileId: fileId,
                            fileName: f.name,
                            fileUrl: `https://upload.local/file/${encodeURIComponent(f.name)}`,
                            content: currentChunk.trim(),
                            tokenCount: Math.ceil(currentChunk.length / 4),
                            chunkIndex: chunkIndex++,
                            similarity: 1.0,
                            pageNumber: null,
                            sectionHeading: null,
                        })
                        currentChunk = w
                    } else {
                        currentChunk += (currentChunk ? ' ' : '') + w
                    }
                }
                if (currentChunk.trim()) {
                    pseudoChunks.push({
                        id: `${fileId}-${chunkIndex}`,
                        fileId: fileId,
                        fileName: f.name,
                        fileUrl: `https://upload.local/file/${encodeURIComponent(f.name)}`,
                        content: currentChunk.trim(),
                        tokenCount: Math.ceil(currentChunk.length / 4),
                        chunkIndex: chunkIndex,
                        similarity: 1.0,
                        pageNumber: null,
                        sectionHeading: null,
                    })
                }
            }
        })

        if (pseudoChunks.length > 0) {
            ragChunks = [...ragChunks, ...pseudoChunks]
            ragContext = buildRAGContext(ragChunks)
            ragSystemMessage = RAG_GROUNDING_INSTRUCTION
            ragSourcesBlock = buildRAGSourcesBlock(ragChunks)
        }

        if (!message) {
            userContent += '\nPlease analyze these files.'
        }
    }

    return {
        userContent,
        ragContext,
        ragSystemMessage,
        ragSourcesBlock,
        ragChunks,
        memoryContextText,
        memoryAttributionText,
        usedMemories,
    }
}

/** Fallback: append raw extracted text from project files (legacy, pre-RAG). */
async function appendLegacyProjectContext(userContent: string, projectId: string): Promise<string> {
    const { data: projectFiles } = await supabase
        .from('files')
        .select('name, extracted_text')
        .eq('project_id', projectId)
        .not('extracted_text', 'is', null)

    if (projectFiles && projectFiles.length > 0) {
        userContent += `\n\n--- PROJECT CONTEXT (${projectFiles.length} files) ---\n`
        projectFiles.forEach(f => {
            const text = f.extracted_text?.slice(0, 20000) || ''
            userContent += `\nFILE: ${f.name}\nCONTENT:\n${text}\n----------------\n`
        })
        userContent += `\n[INSTRUCTION: Use the above PROJECT CONTEXT to answer the user's query. Cite specific files if relevant.]`
    }
    return userContent
}
