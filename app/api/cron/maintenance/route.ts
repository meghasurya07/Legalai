/**
 * Cron: Scheduled Maintenance (H28)
 * 
 * Runs all periodic maintenance tasks:
 * - Memory decay
 * - Memory consolidation
 * - Importance re-evaluation
 * - Firm pattern promotion
 * - Stale memory archival
 * 
 * Should be called by a cron scheduler (e.g., Vercel Cron, Supabase Edge Function).
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runScheduledMaintenance } from '@/lib/jobs/scheduler'
import { logger } from '@/lib/logger'

export const maxDuration = 300 // 5 minutes max for maintenance

export async function GET(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get optional org scope from query params
        const { searchParams } = new URL(request.url)
        const organizationId = searchParams.get('org_id') || undefined

        logger.info("cron/maintenance", `[Cron] Maintenance triggered${organizationId ? ` for org ${organizationId}` : ''}`)

        const result = await runScheduledMaintenance(organizationId)

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error) {
        logger.error("cron/maintenance", 'Maintenance cron failed', error)
        return NextResponse.json(
            { error: 'Maintenance failed', message: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        )
    }
}
