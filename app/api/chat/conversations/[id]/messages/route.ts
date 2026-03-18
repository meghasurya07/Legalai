import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getUserId } from '@/lib/get-user-id'
import OpenAI from 'openai'
import { AI_MODELS } from '@/lib/ai/config'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/chat/conversations/[id]/messages - Add message to conversation
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const body = await request.json()
        const { sanitizeText, validateEnum } = await import('@/lib/validation')

        const role = validateEnum(body.role, ['user', 'assistant'] as const)
        const content = sanitizeText(body.content, 100000)
        const attachments = Array.isArray(body.attachments) ? body.attachments : []

        if (!role || !content) {
            return NextResponse.json({ error: 'Valid role and content are required' }, { status: 400 })
        }

        // Verify the user owns this conversation
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (convError || !conv) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
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

        // Update conversation's updated_at
        await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)

        // Fire-and-forget: generate title in the background if this is the first user message
        if (role === 'user') {
            // Don't await — let it run in the background
            generateTitleIfNeeded(id, content).catch(err =>
                console.error('[Title Gen] Background error:', err)
            )
        }

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

/**
 * Background title generation using the cheapest model (gpt-4.1-nano).
 * Only generates a title if the conversation doesn't already have one.
 */
async function generateTitleIfNeeded(conversationId: string, messageContent: string) {
    const { data: conv } = await supabase
        .from('conversations')
        .select('title')
        .eq('id', conversationId)
        .single()

    if (conv?.title) return // Already has a title

    let title: string
    try {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) throw new Error('No API key')

        const client = new OpenAI({ apiKey })
        const completion = await client.chat.completions.create({
            model: AI_MODELS.titleGeneration,
            messages: [
                {
                    role: 'system',
                    content: 'Generate a short, concise title (max 6 words) for a conversation. Return ONLY the title text, no quotes, no punctuation at the end.'
                },
                {
                    role: 'user',
                    content: messageContent.slice(0, 200)
                }
            ],
            max_tokens: 30,
            temperature: 0.3,
        })
        const raw = completion.choices[0]?.message?.content || ''
        title = raw.trim().replace(/^["']|["']$/g, '').slice(0, 60) || messageContent.slice(0, 50)
    } catch {
        // Fallback to first 50 chars if AI fails
        title = messageContent.slice(0, 50) + (messageContent.length > 50 ? '...' : '')
    }

    await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId)
}

// GET /api/chat/conversations/[id]/messages - Get messages for conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        // Verify the user owns this conversation
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (convError || !conv) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

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
