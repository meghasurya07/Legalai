import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ fileId: string }>
}

// GET /api/vault/documents/[fileId]/chunk?index=N - Get specific chunk content
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { fileId } = await params
        const { searchParams } = new URL(request.url)
        const chunkIndex = searchParams.get('index')

        if (chunkIndex === null) {
            return apiError('Missing chunk index parameter', 400)
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
