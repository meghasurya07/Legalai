import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { callAISafe } from '@/lib/ai/client'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/chat/conversations/[id]/messages - Add message to conversation
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { role, content, attachments = [] } = body

        if (!role || !content) {
            return NextResponse.json({ error: 'Role and content are required' }, { status: 400 })
        }

        // Add message
        const { data: message, error: msgError } = await supabase
            .from('messages')
            .insert({
                conversation_id: id,
                role,
                content,
                attachments
            })
            .select()
            .single()

        if (msgError) {
            console.error('Error adding message:', msgError)
            return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
        }

        // Update conversation's updated_at and auto-generate title from first user message
        const { data: conv } = await supabase
            .from('conversations')
            .select('title')
            .eq('id', id)
            .single()

        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString()
        }

        // AI-generate title from first user message if no title exists
        if (!conv?.title && role === 'user') {
            try {
                const { result } = await callAISafe('assistant_chat', {
                    message: `Generate a short, concise title (max 6 words) for a conversation that starts with this message. Return ONLY the title text, no quotes, no punctuation at the end.\n\nMessage: ${content.slice(0, 200)}`
                })
                updates.title = result.trim().replace(/^["']|["']$/g, '').slice(0, 60) || content.slice(0, 50)
            } catch {
                // Fallback to first 50 chars if AI fails
                updates.title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
            }
        }

        await supabase
            .from('conversations')
            .update(updates)
            .eq('id', id)

        return NextResponse.json({
            id: message.id,
            role: message.role,
            content: message.content,
            attachments: message.attachments,
            createdAt: message.created_at
        }, { status: 201 })
    } catch (error) {
        console.error('Error in POST /api/chat/conversations/[id]/messages:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET /api/chat/conversations/[id]/messages - Get messages for conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching messages:', error)
            return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
        }

        const messages = data.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            attachments: m.attachments,
            createdAt: m.created_at
        }))

        return NextResponse.json(messages)
    } catch (error) {
        console.error('Error in GET /api/chat/conversations/[id]/messages:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
