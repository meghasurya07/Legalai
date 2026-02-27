import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { ingestFile } from '@/lib/rag'
import { analyzeDocument } from '@/lib/document-intelligence'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/documents/projects/[id]/files - List files in project
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('project_id', id)
            .order('uploaded_at', { ascending: false })

        if (error) {
            return apiError('Failed to fetch files', 500, error)
        }

        // Generate signed URLs for all files
        const filePaths = data.map(f => f.url)
        const { data: signedUrls, error: signedError } = await supabase.storage
            .from('documents')
            .createSignedUrls(filePaths, 3600) // 1 hour expiry

        if (signedError) {
            console.error('Failed to generate signed URLs:', signedError)
        }

        const files = data.map((f, index) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            url: signedUrls?.[index]?.signedUrl || f.url, // Fallback to path if signing fails
            uploadedAt: f.uploaded_at,
            extracted_text: f.extracted_text || null,
            status: f.status
        }))

        return NextResponse.json(files)
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// POST /api/documents/projects/[id]/files - Add file to project
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return apiError('No file provided', 400)
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const fileExt = file.name.split('.').pop()?.toLowerCase()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${id}/${fileName}`

        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) {
            return apiError('Failed to upload file to storage', 500, uploadError)
        }

        // Get signed URL for the newly uploaded file
        const { data: signedData } = await supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600)

        // 2. Extract Text
        let extractedText = ''
        try {
            const { extractText } = await import('@/lib/ai/extract-text')
            extractedText = await extractText(file)
        } catch (extractError) {
            console.error('Text extraction error:', extractError)
            // Continue without text (it will just be a file reference)
        }

        const hasText = extractedText.trim().length > 0

        // Sanitize extracted text: remove null bytes (PostgreSQL text columns reject \u0000)
        const sanitizedText = extractedText.trim().replace(/\0/g, '')

        // 3. Save to Database — status is 'processing' if text is available for RAG ingestion
        const { data: fileRecord, error: dbError } = await supabase
            .from('files')
            .insert({
                project_id: id,
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                type: file.type,
                url: filePath, // Store just the path now
                extracted_text: sanitizedText,
                status: hasText ? 'processing' : 'ready',
                source: 'upload'
            })
            .select()
            .single()

        if (dbError) {
            return apiError('Failed to save file metadata', 500, dbError)
        }

        // Update project file count
        await supabase.rpc('increment_file_count', { project_id: id })

        // 4. Fire-and-forget RAG ingestion (async, non-blocking)
        if (hasText) {
            ingestFile(fileRecord.id, id, sanitizedText, file.name)
                .then(({ chunksCreated, success }) => {
                    console.log(`[RAG] File ${fileRecord.id} ingestion complete: ${chunksCreated} chunks, success=${success}`)
                })
                .catch(err => {
                    console.error(`[RAG] File ${fileRecord.id} ingestion failed:`, err)
                })

            // 5. Fire-and-forget Document Intelligence (async, non-blocking)
            analyzeDocument(fileRecord.id, id, sanitizedText)
                .then(({ success }) => {
                    console.log(`[DocIntel] File ${fileRecord.id} analysis complete, success=${success}`)
                })
                .catch(err => {
                    console.error(`[DocIntel] File ${fileRecord.id} analysis failed:`, err)
                })
        }

        return NextResponse.json({
            id: fileRecord.id,
            name: fileRecord.name,
            size: fileRecord.size,
            type: fileRecord.type,
            url: signedData?.signedUrl || filePath,
            uploadedAt: fileRecord.uploaded_at,
            status: fileRecord.status
        }, { status: 201 })

    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
