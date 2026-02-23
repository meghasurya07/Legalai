import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// GET /api/chat/conversations - List conversations
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // 'assistant' | 'vault' | 'workflow'
        const projectId = searchParams.get('projectId')
        const workflowId = searchParams.get('workflowId')
        const limit = parseInt(searchParams.get('limit') || '20')

        let query = supabase
            .from('conversations')
            .select(`
                id,
                title,
                type,
                pinned,
                project_id,
                workflow_id,
                created_at,
                updated_at,
                messages (
                    id,
                    content,
                    role,
                    created_at
                )
            `)
            .order('pinned', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(limit)

        // Filter by type if provided
        if (type) {
            query = query.eq('type', type)
        }

        // Filter by project if provided
        if (projectId) {
            query = query.eq('project_id', projectId)
        }

        // Filter by workflow if provided
        if (workflowId) {
            query = query.eq('workflow_id', workflowId)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching conversations:', error)
            return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
        }

        // Transform to frontend format
        const conversations = data.map(conv => ({
            id: conv.id,
            title: conv.title || 'New Conversation',
            type: conv.type,
            pinned: conv.pinned || false,
            projectId: conv.project_id,
            workflowId: conv.workflow_id,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
            // Get first message as preview
            preview: conv.messages?.[0]?.content?.slice(0, 100) || '',
            messageCount: conv.messages?.filter(m => m.role === 'user').length || 0
        }))

        return NextResponse.json(conversations)
    } catch (error) {
        console.error('Error in GET /api/chat/conversations:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/chat/conversations - Create new conversation
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { title, type = 'assistant', projectId, workflowId } = body

        const { data, error } = await supabase
            .from('conversations')
            .insert({
                title: title || null,
                type,
                project_id: projectId || null,
                workflow_id: workflowId || null
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating conversation:', error)
            return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
        }

        return NextResponse.json({
            id: data.id,
            title: data.title,
            type: data.type,
            projectId: data.project_id,
            workflowId: data.workflow_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, { status: 201 })
    } catch (error) {
        console.error('Error in POST /api/chat/conversations:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
