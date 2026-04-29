import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit, RATE_LIMIT_UPLOAD } from '@/lib/rate-limit'
import { ingestFile } from '@/lib/rag'
import { analyzeDocument } from '@/lib/document-intelligence'
import { logger } from '@/lib/logger'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/documents/projects/[id]/files - List files in project
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth
        if (!userId) return apiError('Unauthorized', 401)

        const { id } = await params

        // Verify project ownership
        const { data: project, error: projError } = await supabase
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (projError || !project) {
            return apiError('Project not found', 404)
        }

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
        let signedUrls: { signedUrl: string }[] | null = null

        if (filePaths.length > 0) {
            const { data: signed, error: signedError } = await supabase.storage
                .from('documents')
                .createSignedUrls(filePaths, 3600)

            if (signedError) {
                logger.error("api", "Failed to generate signed URLs:", signedError)
            }
            signedUrls = signed
        }

        const files = data.map((f, index) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            url: signedUrls?.[index]?.signedUrl || f.url,
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
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth
        if (!userId) return apiError('Unauthorized', 401)

        const { id } = await params

        // Verify project ownership
        const { data: project, error: projError } = await supabase
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (projError || !project) {
            return apiError('Project not found', 404)
        }

        // Rate limit uploads
        const { allowed } = checkRateLimit(`upload:${userId}`, RATE_LIMIT_UPLOAD)
        if (!allowed) {
            return apiError('Too many uploads. Please slow down.', 429)
        }

        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return apiError('No file provided', 400)
        }

        const { validateFileUpload } = await import('@/lib/validation')
        const validation = validateFileUpload(file)
        if (!validation.valid) {
            return apiError(validation.error || 'Invalid file', 400)
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
            logger.error("api", "Text extraction error:", extractError)
        }

        const hasText = extractedText.trim().length > 0
        const sanitizedText = extractedText.trim().replace(/\0/g, '')

        // 3. Save to Database
        const { data: fileRecord, error: dbError } = await supabase
            .from('files')
            .insert({
                project_id: id,
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                type: file.type,
                url: filePath,
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

        // 4. Fire-and-forget RAG ingestion
        if (hasText) {
            ingestFile(fileRecord.id, id, sanitizedText, file.name)
                .then(({ chunksCreated, success }) => {
                    logger.info("files/route", `[RAG] File ${fileRecord.id} ingestion complete: ${chunksCreated} chunks, success=${success}`)
                })
                .catch(err => {
                    logger.error("rag", `File ${fileRecord.id} ingestion failed`, err)
                })

            // 5. Fire-and-forget Document Intelligence
            analyzeDocument(fileRecord.id, id, sanitizedText)
                .then(({ success }) => {
                    logger.info("files/route", `[DocIntel] File ${fileRecord.id} analysis complete, success=${success}`)
                })
                .catch(err => {
                    logger.error("doc-intel", `File ${fileRecord.id} analysis failed`, err)
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