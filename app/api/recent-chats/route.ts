import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getUserId } from '@/lib/get-user-id'

// GET /api/recent-chats - List all history items for current user
export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')

        let query = supabase
            .from('recent_chats')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)

        if (type && type !== 'all') {
            query = query.eq('type', type)
        }

        const { data, error } = await query

        if (error) {
            return apiError('Failed to fetch history', 500, error)
        }

        const items = data.map(h => ({
            id: h.id,
            title: h.title,
            subtitle: h.subtitle,
            type: h.type,
            date: h.created_at,
            preview: h.preview,
            meta: h.meta
        }))

        return NextResponse.json(items)
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// POST /api/recent-chats - Create a history item
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const body = await request.json()
        const { title, subtitle, type, preview, meta } = body

        if (!title || !type || !preview) {
            return NextResponse.json({ error: 'Title, type, and preview are required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('recent_chats')
            .insert({
                title,
                subtitle,
                type,
                preview,
                meta: meta || {},
                user_id: userId
            })
            .select()
            .single()

        if (error) {
            return apiError('Failed to create history item', 500, error)
        }

        return NextResponse.json({
            id: data.id,
            title: data.title,
            subtitle: data.subtitle,
            type: data.type,
            date: data.created_at,
            preview: data.preview,
            meta: data.meta
        }, { status: 201 })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}

// DELETE /api/recent-chats - Clear all history for current user
export async function DELETE() {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { error } = await supabase
            .from('recent_chats')
            .delete()
            .eq('user_id', userId)

        if (error) {
            console.error('Error clearing history:', error)
            return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in DELETE /api/recent-chats:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
