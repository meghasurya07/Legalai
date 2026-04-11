import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/auth/get-user-id'
import { checkRateLimit, RATE_LIMIT_UPLOAD } from '@/lib/rate-limit'

// POST /api/documents/upload - Upload ephemeral file to project-less storage
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

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
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        // Store in a dedicated folder for ephemeral uploads
        const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
        const filePath = `ephemeral-uploads/${safeUserId}/${fileName}`

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
            extractedText = await extractText(file) // Extract uses local processing for standard docs
        } catch (extractError) {
            console.error('Text extraction error:', extractError)
            
            // Fallback for plain text files if AI extraction fails
            if (file.type.startsWith('text/') || file.name.endsWith('.csv')) {
                extractedText = buffer.toString('utf-8')
            }
        }

        const hasText = extractedText.trim().length > 0
        const sanitizedText = extractedText.trim().replace(/\0/g, '')

        // 3. Save to Database (without project_id)
        // Note: Make sure project_id is nullable in your database.
        const { data: fileRecord, error: dbError } = await supabase
            .from('files')
            .insert({
                project_id: null, // Ephemeral global file
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                type: file.type,
                url: filePath,
                extracted_text: sanitizedText,
                status: hasText ? 'ready' : 'failed',
                source: 'upload'
            })
            .select()
            .single()

        if (dbError) {
            return apiError('Failed to save file metadata', 500, dbError)
        }

        // We skip RAG ingestion and DocIntel for global chat uploads since they
        // aren't meant to be part of the permanent cross-referenced knowledge base.
        // Instead they are just passed to the chat context explicitly.

        return NextResponse.json({
            id: fileRecord.id,
            name: fileRecord.name,
            size: fileRecord.size,
            type: fileRecord.type,
            url: signedData?.signedUrl || filePath,
            uploadedAt: fileRecord.uploaded_at,
            status: fileRecord.status,
            content: sanitizedText // We return the text so the frontend can immediately inject it into the prompt if needed
        }, { status: 201 })

    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
