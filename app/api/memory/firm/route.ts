import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { apiError } from '@/lib/api-utils'
import { getFirmDashboard, detectFirmPatterns } from '@/lib/memory/firm-intelligence'

/**
 * GET /api/memory/firm?organizationId=xxx — Get firm intelligence dashboard
 */
export async function GET(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) return apiError('organizationId is required', 400)

    const dashboard = await getFirmDashboard(organizationId)
    return NextResponse.json({ dashboard })
}

/**
 * POST /api/memory/firm — Trigger firm pattern detection
 */
export async function POST(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)

    const body = await request.json()
    const { organizationId } = body

    if (!organizationId) return apiError('organizationId is required', 400)

    const patterns = await detectFirmPatterns(organizationId)
    return NextResponse.json({ patterns, count: patterns.length })
}
