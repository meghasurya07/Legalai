import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/get-user-id'

// GET /api/documents/projects - List all projects for the current user
export async function GET() {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) {
            return apiError('Failed to fetch projects', 500, error)
        }

        // Transform to match frontend interface
        const projects = data.map(p => ({
            id: p.id,
            title: p.title,
            organization: p.organization,
            fileCount: p.file_count,
            queryCount: p.query_count,
            isSecured: p.is_secured,
            icon: p.icon,
            files: [] // Files loaded separately
        }))

        return NextResponse.json(projects)
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// POST /api/documents/projects - Create a new project
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const body = await request.json()
        const { title } = body

        if (!title || typeof title !== 'string') {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('projects')
            .insert({ title: title.trim(), user_id: userId })
            .select()
            .single()

        if (error) {
            return apiError('Failed to create project', 500, error)
        }

        // Transform to match frontend interface
        const project = {
            id: data.id,
            title: data.title,
            organization: data.organization,
            fileCount: data.file_count,
            queryCount: data.query_count,
            isSecured: data.is_secured,
            icon: data.icon,
            files: []
        }

        return NextResponse.json(project, { status: 201 })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
