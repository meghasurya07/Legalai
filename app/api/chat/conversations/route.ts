import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getOrgContext } from '@/lib/get-org-context'

// GET /api/chat/conversations - List conversations for current user
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

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
            .eq('user_id', userId)
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
            logger.error('Error fetching conversations:', 'Error', error)
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
        logger.error("GET /api/chat/conversations:", "Request failed", error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/chat/conversations - Create new conversation
export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const body = await request.json()
        const { sanitizeShortText, validateUUID, validateEnum } = await import('@/lib/validation')
        
        const title = body.title ? sanitizeShortText(body.title, 200) : null
        const type = validateEnum(body.type || 'assistant', ['assistant', 'vault', 'workflow']) || 'assistant'
        const projectId = validateUUID(body.projectId)
        const workflowId = validateUUID(body.workflowId)

        const { data, error } = await supabase
            .from('conversations')
            .insert({
                title: title || null,
                type,
                project_id: projectId || null,
                workflow_id: workflowId || null,
                user_id: userId,
                org_id: ctx?.orgId || null
            })
            .select()
            .single()

        if (error) {
            logger.error('Error creating conversation:', 'Error', error)
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
        logger.error("POST /api/chat/conversations:", "Request failed", error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}