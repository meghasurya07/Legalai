/**
 * RAG Ingestion Pipeline
 * 
 * Processes uploaded files: chunk → embed → store in file_chunks.
 * Designed to run async (fire-and-forget) after file upload.
 */

import { chunkText } from './chunker'
import { embedChunks } from './embeddings'
import { supabase } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Ingest a file's extracted text into the RAG system.
 * Creates semantic chunks, generates embeddings, and stores them.
 * 
 * @param fileId - UUID of the file record
 * @param projectId - UUID of the project
 * @param text - Extracted text content
 * @param fileName - Original file name for metadata
 */
export async function ingestFile(
    fileId: string,
    projectId: string,
    text: string,
    fileName?: string
): Promise<{ chunksCreated: number; success: boolean }> {
    const startTime = Date.now()

    try {
        if (!text || text.trim().length === 0) {
            logger.info("rag/ingest", `[RAG Ingest] Skipping file ${fileId} — no text content`)
            return { chunksCreated: 0, success: true }
        }

        // 1. Check for existing chunks (prevent duplicates)
        const { count: existingCount } = await supabase
            .from('file_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', fileId)

        if (existingCount && existingCount > 0) {
            logger.info("rag/ingest", `[RAG Ingest] Skipping file ${fileId} — ${existingCount} chunks already exist`)
            return { chunksCreated: 0, success: true }
        }

        // 2. Chunk the text
        const chunks = chunkText(text)
        if (chunks.length === 0) {
            logger.info("rag/ingest", `[RAG Ingest] File ${fileId} produced no valid chunks`)
            await updateFileStatus(fileId, 'ready')
            return { chunksCreated: 0, success: true }
        }

        logger.info("rag/ingest", `[RAG Ingest] File ${fileId}: ${chunks.length} chunks created, generating embeddings...`)

        // 3. Generate embeddings
        const embeddedChunks = await embedChunks(
            chunks.map(c => ({
                ...c,
                fileName: fileName || undefined,
            }))
        )

        if (embeddedChunks.length === 0) {
            logger.error('lib', `[RAG Ingest] File ${fileId}: embedding generation failed completely`)
            await updateFileStatus(fileId, 'ready') // Don't block — file is still usable
            return { chunksCreated: 0, success: false }
        }

        // 4. Store chunks in database
        const records = embeddedChunks.map(ec => ({
            file_id: fileId,
            project_id: projectId,
            content: ec.content,
            token_count: ec.tokenCount,
            embedding: JSON.stringify(ec.embedding), // pgvector accepts JSON array
            chunk_index: ec.chunkIndex,
            file_name: ec.fileName || fileName || null,
            page_number: ec.pageNumber || null,
            section_heading: ec.sectionHeading || null,
        }))

        // Insert in batches of 50 to avoid payload limits
        const BATCH_SIZE = 50
        let inserted = 0
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE)
            const { error } = await supabase
                .from('file_chunks')
                .insert(batch)

            if (error) {
                logger.error('lib', `[RAG Ingest] Batch insert error for file ${fileId}:`, error)
                // Continue with remaining batches
            } else {
                inserted += batch.length
            }
        }

        // 5. Update file status
        await updateFileStatus(fileId, 'ready')

        const duration = Date.now() - startTime
        logger.info("rag/ingest", `[RAG Ingest] File ${fileId}: ${inserted}/${embeddedChunks.length} chunks stored in ${duration}ms`)

        return { chunksCreated: inserted, success: true }
    } catch (error) {
        logger.error('lib', `[RAG Ingest] Fatal error for file ${fileId}:`, error)
        await updateFileStatus(fileId, 'ready') // Don't leave file stuck in "processing"
        return { chunksCreated: 0, success: false }
    }
}

/**
 * Update file status in the database.
 */
async function updateFileStatus(fileId: string, status: string): Promise<void> {
    const { error } = await supabase
        .from('files')
        .update({ status })
        .eq('id', fileId)

    if (error) {
        logger.error('lib', `[RAG Ingest] Failed to update file ${fileId} status to ${status}:`, error)
    }
}

/**
 * Delete all chunks for a specific file.
 * Called when a file is deleted from the vault.
 */
export async function deleteFileChunks(fileId: string): Promise<void> {
    const { error, count } = await supabase
        .from('file_chunks')
        .delete()
        .eq('file_id', fileId)

    if (error) {
        logger.error('lib', `[RAG Ingest] Failed to delete chunks for file ${fileId}:`, error)
    } else {
        logger.info("rag/ingest", `[RAG Ingest] Deleted ${count ?? 'all'} chunks for file ${fileId}`)
    }
}
