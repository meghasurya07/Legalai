import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/auth/get-user-id'

interface RouteParams {
    params: Promise<{ fileId: string }>
}

// GET /api/documents/documents/[fileId]/chunk?index=N - Get specific chunk content
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { fileId } = await params
        const { searchParams } = new URL(request.url)
        const chunkIndex = searchParams.get('index')

        if (chunkIndex === null) {
            return apiError('Missing chunk index parameter', 400)
        }

        // Verify ownership: file → project → user
        const { data: file, error: fileError } = await supabase
            .from('files')
            .select('id, projects!inner(user_id)')
            .eq('id', fileId)
            .single()

        if (fileError || !file) {
            return apiError('Document not found', 404)
        }

        const project = file.projects as unknown as { user_id: string }
        if (project.user_id !== userId) {
            return apiError('Document not found', 404)
        }

        const { data: chunk, error } = await supabase
            .from('file_chunks')
            .select('id, content, chunk_index, file_name, page_number, section_heading, token_count')
            .eq('file_id', fileId)
            .eq('chunk_index', parseInt(chunkIndex, 10))
            .single()

        if (error || !chunk) {
            return apiError('Chunk not found', 404, error)
        }

        return NextResponse.json({
            id: chunk.id,
            content: chunk.content,
            chunkIndex: chunk.chunk_index,
            fileName: chunk.file_name,
            pageNumber: chunk.page_number,
            sectionHeading: chunk.section_heading,
            tokenCount: chunk.token_count
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
