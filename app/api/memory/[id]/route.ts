import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * PATCH /api/memory/[id] — Update a memory (edit content, pin, change importance)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth

    const { id } = await params
    const body = await request.json()
    const { content, importance, is_pinned, memory_type } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (content !== undefined) updates.content = content
    if (importance !== undefined) updates.importance = importance
    if (is_pinned !== undefined) updates.is_pinned = is_pinned
    if (memory_type !== undefined) updates.memory_type = memory_type

    const { data: memory, error } = await supabase
        .from('memories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return apiError(error.message, 500)
    if (!memory) return apiError('Memory not found', 404)

    return NextResponse.json({ memory })
}

/**
 * DELETE /api/memory/[id] — Soft-delete a memory
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth

    const { id } = await params

    // Soft delete
    const { error } = await supabase
        .from('memories')
        .update({
            is_active: false,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)

    if (error) return apiError(error.message, 500)

    return NextResponse.json({ success: true })
}