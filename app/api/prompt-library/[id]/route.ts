import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

// GET /api/prompt-library/[id] — Get single prompt
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth

        const { id } = await params

        const { data, error } = await supabase
            .from('prompt_library')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !data) {
            return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
        }

        return NextResponse.json(data)
    } catch (error) {
        logger.error('Error in GET /api/prompt-library/[id]:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/prompt-library/[id] — Update a prompt
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params
        const body = await req.json()

        // Fetch existing prompt to check ownership
        const { data: existing } = await supabase
            .from('prompt_library')
            .select('user_id, org_id')
            .eq('id', id)
            .single()

        if (!existing) {
            return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
        }

        // Check permissions: owner or FIRM_ADMIN
        const isOwner = existing.user_id === userId
        let isAdmin = false

        if (!isOwner && existing.org_id) {
            const { data: member } = await supabase
                .from('organization_members')
                .select('role')
                .eq('user_id', userId)
                .eq('org_id', existing.org_id)
                .single()
            isAdmin = member?.role === 'admin'
        }

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'You can only edit your own prompts' }, { status: 403 })
        }

        // Only admins can pin or set org-wide visibility
        if (!isAdmin) {
            delete body.is_pinned
            if (body.access_level === 'organization' || body.access_level === 'global') {
                // Non-admins can still set to org if they're the owner, but cannot pin
            }
        }

        const { data, error } = await supabase
            .from('prompt_library')
            .update({
                ...body,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            logger.error('Error updating prompt:', 'Error', error)
            return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error) {
        logger.error('Error in PUT /api/prompt-library/[id]:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/prompt-library/[id] — Delete a prompt
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { id } = await params

        // Fetch existing to check ownership
        const { data: existing } = await supabase
            .from('prompt_library')
            .select('user_id, org_id')
            .eq('id', id)
            .single()

        if (!existing) {
            return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
        }

        const isOwner = existing.user_id === userId
        let isAdmin = false

        if (!isOwner && existing.org_id) {
            const { data: member } = await supabase
                .from('organization_members')
                .select('role')
                .eq('user_id', userId)
                .eq('org_id', existing.org_id)
                .single()
            isAdmin = member?.role === 'admin'
        }

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'You can only delete your own prompts' }, { status: 403 })
        }

        const { error } = await supabase
            .from('prompt_library')
            .delete()
            .eq('id', id)

        if (error) {
            logger.error('Error deleting prompt:', 'Error', error)
            return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error('Error in DELETE /api/prompt-library/[id]:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
