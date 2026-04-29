import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

// POST /api/prompt-library/[id]/use — Record prompt usage
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth

        const { id } = await params

        // Increment usage_count and set last_used_at
        const { error } = await supabase.rpc('increment_prompt_usage', { prompt_id: id })

        // Fallback if RPC doesn't exist: manual update
        if (error) {
            const { data: prompt, error: fetchError } = await supabase
                .from('prompt_library')
                .select('usage_count')
                .eq('id', id)
                .single()

            if (fetchError || !prompt) {
                return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
            }

            const { error: updateError } = await supabase
                .from('prompt_library')
                .update({
                    usage_count: (prompt.usage_count || 0) + 1,
                    last_used_at: new Date().toISOString(),
                })
                .eq('id', id)

            if (updateError) {
                logger.error('Error recording prompt usage:', 'Error', updateError)
                return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 })
            }
        }

        // Return the full prompt for the "Use Prompt" flow
        const { data: fullPrompt } = await supabase
            .from('prompt_library')
            .select('*')
            .eq('id', id)
            .single()

        return NextResponse.json(fullPrompt)
    } catch (error) {
        logger.error('Error in POST /api/prompt-library/[id]/use:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
