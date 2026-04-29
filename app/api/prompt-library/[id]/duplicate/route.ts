import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

// POST /api/prompt-library/[id]/duplicate — Duplicate a prompt
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId, userName } = auth

        const { id } = await params

        // Fetch original prompt
        const { data: original, error: fetchError } = await supabase
            .from('prompt_library')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !original) {
            return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
        }

        // Get user's org
        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        // Create duplicate
        const { data, error } = await supabase
            .from('prompt_library')
            .insert({
                title: `Copy of ${original.title}`,
                content: original.content,
                description: original.description,
                category: original.category,
                type: original.type,
                access_level: 'private', // Always private for duplicates
                tags: original.tags,
                variables: original.variables,
                source_references: original.source_references,
                rules: original.rules,
                example_input: original.example_input,
                example_output: original.example_output,
                user_id: userId,
                org_id: membership?.org_id || null,
                created_by_name: userName,
                usage_count: 0,
                is_pinned: false,
            })
            .select()
            .single()

        if (error) {
            logger.error('Error duplicating prompt:', 'Error', error)
            return NextResponse.json({ error: 'Failed to duplicate prompt' }, { status: 500 })
        }

        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        logger.error('Error in POST /api/prompt-library/[id]/duplicate:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
