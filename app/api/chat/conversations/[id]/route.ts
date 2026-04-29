import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/chat/conversations/[id] - Get conversation with messages
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params

        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (convError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true })

        if (msgError) {
            logger.error("api", "Error fetching messages:", msgError)
        }

        return NextResponse.json({
            id: conversation.id,
            title: conversation.title,
            type: conversation.type,
            pinned: conversation.pinned || false,
            projectId: conversation.project_id,
            workflowId: conversation.workflow_id,
            createdAt: conversation.created_at,
            updatedAt: conversation.updated_at,
            messages: (messages || []).map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                attachments: m.attachments,
                createdAt: m.created_at
            }))
        })
    } catch (error) {
        logger.error("api", "Error in GET /api/chat/conversations/[id]:", error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/chat/conversations/[id] - Update conversation (title, pinned)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params
        const body = await request.json()

        const { sanitizeShortText } = await import('@/lib/validation')
        
        const updateFields: Record<string, unknown> = {
            updated_at: new Date().toISOString()
        }

        if ('title' in body && body.title !== undefined) {
            updateFields.title = body.title === null ? null : sanitizeShortText(body.title, 200)
        }
        if ('pinned' in body) {
            updateFields.pinned = !!body.pinned
        }

        const { data, error } = await supabase
            .from('conversations')
            .update(updateFields)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) {
            logger.error("api", "Error updating conversation:", error)
            return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
        }

        return NextResponse.json({
            id: data.id,
            title: data.title,
            type: data.type,
            pinned: data.pinned || false,
            updatedAt: data.updated_at
        })
    } catch (error) {
        logger.error("api", "Error in PATCH /api/chat/conversations/[id]:", error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/chat/conversations/[id] - Delete conversation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params

        // get conversation first to check project linkage
        const { data: conversation } = await supabase
            .from('conversations')
            .select('project_id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) {
            logger.error("api", "Error deleting conversation:", error)
            return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
        }

        // duplicate logic: update project query count
        if (conversation?.project_id) {
            const { data: project } = await supabase
                .from('projects')
                .select('query_count')
                .eq('id', conversation.project_id)
                .eq('user_id', userId)
                .single()

            if (project) {
                await supabase
                    .from('projects')
                    .update({
                        query_count: Math.max(0, (project.query_count || 0) - 1),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversation.project_id)
                    .eq('user_id', userId)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error("api", "Error in DELETE /api/chat/conversations/[id]:", error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}