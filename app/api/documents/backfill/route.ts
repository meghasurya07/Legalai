/**
 * Vault RAG Backfill API
 * 
 * Processes existing files that have extracted_text but no chunks in file_chunks.
 * POST /api/documents/backfill
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { ingestFile } from '@/lib/rag'
import { analyzeDocument } from '@/lib/document-intelligence'
import { apiError } from '@/lib/api-utils'

export async function POST() {
    try {
        // 1. Find all files with extracted_text
        const { data: files, error: filesError } = await supabase
            .from('files')
            .select('id, project_id, name, extracted_text')
            .not('extracted_text', 'is', null)

        if (filesError) {
            return apiError('Failed to fetch files for backfill', 500, filesError)
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ message: 'No files to backfill', processed: 0 })
        }

        // 2. Check which files already have chunks
        const fileIds = files.map(f => f.id)
        const { data: existingChunks } = await supabase
            .from('file_chunks')
            .select('file_id')
            .in('file_id', fileIds)

        const filesWithChunks = new Set((existingChunks || []).map(c => c.file_id))

        // 3. Filter to files needing backfill
        const filesToBackfill = files.filter(f =>
            !filesWithChunks.has(f.id) &&
            f.extracted_text &&
            f.extracted_text.trim().length > 0
        )

        if (filesToBackfill.length === 0) {
            return NextResponse.json({ message: 'All files already have chunks', processed: 0 })
        }

        console.log(`[RAG Backfill] Processing ${filesToBackfill.length} files...`)

        // 4. Process each file
        let processed = 0
        let totalChunks = 0
        const errors: string[] = []

        for (const file of filesToBackfill) {
            try {
                const text = file.extracted_text || ''

                // 1. RAG Ingestion
                const ragResult: { success: boolean; chunksCreated: number } = await ingestFile(file.id, file.project_id, text, file.name)

                // 2. Document Intelligence Analysis
                const intelResult: { success: boolean; error?: string } = await analyzeDocument(file.id, file.project_id, text)

                if (ragResult.success || intelResult.success) {
                    processed++
                    totalChunks += ragResult.chunksCreated || 0
                } else {
                    errors.push(`File ${file.id} (${file.name}): processing failed`)
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error'
                errors.push(`File ${file.id} (${file.name}): ${msg}`)
                console.error(`[RAG Backfill] Error processing file ${file.id}:`, err)
            }
        }

        console.log(`[RAG Backfill] Complete: ${processed}/${filesToBackfill.length} files, ${totalChunks} total chunks`)

        return NextResponse.json({
            message: `Backfill complete`,
            total: filesToBackfill.length,
            processed,
            totalChunks,
            errors: errors.length > 0 ? errors : undefined
        })
    } catch (error) {
        return apiError('Backfill failed', 500, error)
    }
}
