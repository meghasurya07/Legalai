import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/documents/projects/[id] - Get single project with files
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single()

        if (projectError || !project) {
            return apiError('Project not found', 404, projectError)
        }

        const { data: files, error: filesError } = await supabase
            .from('files')
            .select('*')
            .eq('project_id', id)
            .order('uploaded_at', { ascending: false })

        if (filesError) {
            console.error('Error fetching files:', filesError)
        }

        // Generate signed URLs for all files (only if there are files)
        const filePaths = (files || []).map(f => f.url)
        let signedUrls: { signedUrl: string }[] | null = null

        if (filePaths.length > 0) {
            const { data, error: signedError } = await supabase.storage
                .from('documents')
                .createSignedUrls(filePaths, 3600)

            if (signedError) {
                console.error('Failed to generate signed URLs for project:', signedError)
            }
            signedUrls = data
        }

        return NextResponse.json({
            id: project.id,
            title: project.title,
            organization: project.organization,
            fileCount: project.file_count,
            queryCount: project.query_count,
            isSecured: project.is_secured,
            icon: project.icon,
            files: (files || []).map((f, index) => ({
                id: f.id,
                name: f.name,
                size: f.size,
                type: f.type,
                url: signedUrls?.[index]?.signedUrl || f.url,
                uploadedAt: f.uploaded_at,
                extracted_text: f.extracted_text || null,
                status: f.status
            }))
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// PATCH /api/documents/projects/[id] - Update project (rename, increment query count)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { title, incrementQueryCount } = body

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (title !== undefined) {
            updates.title = title.trim()
        }

        if (incrementQueryCount) {
            // First get current count
            const { data: current } = await supabase
                .from('projects')
                .select('query_count')
                .eq('id', id)
                .single()

            if (current) {
                updates.query_count = (current.query_count || 0) + 1
            }
        }

        const { data, error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return apiError('Failed to update project', 500, error)
        }

        return NextResponse.json({
            id: data.id,
            title: data.title,
            organization: data.organization,
            fileCount: data.file_count,
            queryCount: data.query_count,
            isSecured: data.is_secured,
            icon: data.icon
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// DELETE /api/documents/projects/[id] - Delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)

        if (error) {
            return apiError('Failed to delete project', 500, error)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
