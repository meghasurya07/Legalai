import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

interface RouteParams {
    params: Promise<{ id: string; versionId: string }>
}

/**
 * GET /api/drafts/[id]/versions/[versionId] — Get a specific version with full content
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth
    const { id, versionId } = await params

    try {
        // Verify ownership
        const { data: draft } = await supabase
            .from('drafts')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (!draft) return apiError('Draft not found', 404)

        const { data: version, error } = await supabase
            .from('draft_versions')
            .select('*')
            .eq('id', versionId)
            .eq('draft_id', id)
            .single()

        if (error || !version) {
            return apiError('Version not found', 404)
        }

        return NextResponse.json({ version })
    } catch (err) {
        logger.error('drafts', `GET version [${versionId}] error`, err)
        return apiError('Failed to load version', 500)
    }
}
