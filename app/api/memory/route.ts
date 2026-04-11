import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth/auth0'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'

/**
 * GET /api/memory — List memories
 * Supports two modes:
 *   1. ?projectId=xxx — List memories for a specific project
 *   2. (no projectId)  — List the current user's memories across all projects
 */
export async function GET(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)
    const userId = session.user.sub

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const memoryType = searchParams.get('type')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const search = searchParams.get('search')

    try {
        // Build query
        let query = supabase
            .from('memories')
            .select('*', { count: 'exact' })
            .eq('is_active', true)

        if (projectId) {
            query = query.eq('project_id', projectId)
        } else {
            query = query.eq('user_id', userId)
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

        if (error) {
            // Handle missing table gracefully
            if (error.message.includes('schema cache') || error.message.includes('memories')) {
                console.warn('[Memory] Table "memories" not found. Run migration 018_memory_layer.sql')
                return NextResponse.json({
                    memories: [],
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                    warning: 'Memory table not found. Run migration 018_memory_layer.sql',
                })
            }
            return apiError(error.message, 500)
        }

        return NextResponse.json({
            memories: memories || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        })
    } catch (err) {
        console.error('[Memory] Unexpected error:', err)
        return NextResponse.json({
            memories: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
        })
    }
}

/**
 * POST /api/memory — Manually add a memory
 * projectId is optional — omit for user-level memories not tied to a project.
 * Accepts both memoryType and memory_type for compatibility.
 */
export async function POST(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)
    const userId = session.user.sub

    // Get org ID
    let orgId = '00000000-0000-0000-0000-000000000001'
    try {
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('default_org_id')
            .eq('user_id', userId)
            .single()
        if (userSettings?.default_org_id) orgId = userSettings.default_org_id
    } catch {
        // user_settings row might not exist
    }

    // Check org-level memory toggle
    try {
        const { data: orgSettings } = await supabase
            .from('organization_settings')
            .select('ai_memory_persistence')
            .eq('organization_id', orgId)
            .single()

        if (orgSettings && orgSettings.ai_memory_persistence === false) {
            return apiError('Memory has been disabled by your organization administrator.', 403)
        }
    } catch {
        // org settings might not exist
    }

    const body = await request.json()
    const content = body.content
    const memoryType = body.memoryType || body.memory_type
    const importance = body.importance
    const projectId = body.projectId || null

    if (!content || !memoryType) {
        return apiError('content and memoryType are required', 400)
    }

    try {
        const { data: memory, error } = await supabase
            .from('memories')
            .insert({
                project_id: projectId,
                organization_id: orgId,
                user_id: userId,
                content,
                memory_type: memoryType,
                source: 'manual',
                importance: importance || 3,
                confidence: 1.0,
                authority_weight: 1.0,
                is_pinned: false,
                is_active: true,
                reinforcement_count: 0,
                decay_weight: 1.0,
                metadata: { added_by: userId },
            })
            .select()
            .single()

        if (error) {
            if (error.message.includes('schema cache') || error.message.includes('memories')) {
                return apiError('Memory table not found. Please run migration 018_memory_layer.sql in your Supabase dashboard.', 500)
            }
            return apiError(error.message, 500)
        }

        return NextResponse.json({ memory }, { status: 201 })
    } catch (err) {
        console.error('[Memory] POST error:', err)
        return apiError('Failed to save memory. The memories table may not exist yet.', 500)
    }
}
