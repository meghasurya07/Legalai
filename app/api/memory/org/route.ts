import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { isFirmAdmin as checkFirmAdmin } from '@/lib/auth/get-user-role'

/**
 * GET /api/memory/org — List all memories across the organization (admin only)
 * Supports filtering by user, type, sorting, and pagination.
 */
export async function GET(request: NextRequest) {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth
    const { userId } = auth

    // Get org ID
    const { data: userData } = await supabase
        .from('user_settings')
        .select('default_org_id')
        .eq('user_id', userId)
        .single()

    const orgId = userData?.default_org_id || '00000000-0000-0000-0000-000000000001'

    // Verify admin access
    const adminByRole = await checkFirmAdmin()

    if (!adminByRole) {
        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return apiError('Only organization admins can access this endpoint', 403)
        }
    }

    const { searchParams } = new URL(request.url)
    const memoryType = searchParams.get('type')
    const filterUserId = searchParams.get('userId')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const search = searchParams.get('search')

    // Build query — all memories in this organization
    let query = supabase
        .from('memories')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .eq('organization_id', orgId)

    if (filterUserId) {
        query = query.eq('user_id', filterUserId)
    }

    if (memoryType) {
        query = query.eq('memory_type', memoryType)
    }

    if (search) {
        query = query.ilike('content', `%${search}%`)
    }

    // Sort
    const validSorts = ['created_at', 'updated_at', 'importance', 'confidence', 'reinforcement_count']
    const sortField = validSorts.includes(sortBy) ? sortBy : 'created_at'
    query = query.order(sortField, { ascending: order === 'asc' })

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: memories, count, error } = await query

    if (error) return apiError(error.message, 500)

    // Get unique user IDs and resolve names
    const userIds = [...new Set((memories || []).map(m => m.user_id).filter(Boolean))]
    const userMap: Record<string, { user_name?: string; profile_image?: string }> = {}

    if (userIds.length > 0) {
        // Try to get names from org members
        const { data: members } = await supabase
            .from('organization_members')
            .select('user_id, user_name, profile_image')
            .eq('organization_id', orgId)
            .in('user_id', userIds)

        if (members) {
            for (const m of members) {
                userMap[m.user_id] = { user_name: m.user_name, profile_image: m.profile_image }
            }
        }
    }

    // Attach user info to memories
    const enrichedMemories = (memories || []).map(mem => ({
        ...mem,
        user_name: userMap[mem.user_id]?.user_name || mem.user_id,
        user_profile_image: userMap[mem.user_id]?.profile_image || null,
    }))

    // Also get org-level stats
    const { count: totalActive } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true)

    const { count: totalPinned } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('is_pinned', true)

    return NextResponse.json({
        memories: enrichedMemories,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        orgStats: {
            totalActive: totalActive || 0,
            totalPinned: totalPinned || 0,
            uniqueUsers: userIds.length,
        },
    })
}