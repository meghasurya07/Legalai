import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

// GET /api/prompt-library — List prompts visible to current user
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const url = new URL(req.url)
        const category = url.searchParams.get('category')
        const type = url.searchParams.get('type')
        const search = url.searchParams.get('search')
        const tab = url.searchParams.get('tab') // all | my | shared | examples | playbooks
        const sort = url.searchParams.get('sort') || 'popular' // popular | recent | alpha

        // Get user's org_id
        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        const orgId = membership?.org_id

        // Build query
        let query = supabase
            .from('prompt_library')
            .select('*')

        // Tab filtering
        if (tab === 'my') {
            query = query.eq('user_id', userId)
        } else if (tab === 'shared') {
            if (orgId) {
                query = query.eq('org_id', orgId).eq('access_level', 'organization')
            }
        } else if (tab === 'examples') {
            query = query.eq('type', 'example')
        } else if (tab === 'playbooks') {
            query = query.eq('type', 'playbook')
        } else {
            // "all" tab: show user's own + org shared + global
            if (orgId) {
                query = query.or(
                    `user_id.eq.${userId},and(org_id.eq.${orgId},access_level.eq.organization),access_level.eq.global`
                )
            } else {
                query = query.or(`user_id.eq.${userId},access_level.eq.global`)
            }
        }

        // Category filter
        if (category && category !== 'All') {
            query = query.eq('category', category)
        }

        // Type filter
        if (type) {
            query = query.eq('type', type)
        }

        // Search
        if (search) {
            query = query.or(
                `title.ilike.%${search}%,content.ilike.%${search}%,description.ilike.%${search}%`
            )
        }

        // Sorting
        query = query.order('is_pinned', { ascending: false })
        if (sort === 'popular') {
            query = query.order('usage_count', { ascending: false })
        } else if (sort === 'recent') {
            query = query.order('created_at', { ascending: false })
        } else if (sort === 'alpha') {
            query = query.order('title', { ascending: true })
        }

        const { data, error } = await query

        if (error) {
            logger.error('Error fetching prompt library:', 'Error', error)
            return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
        }

        return NextResponse.json(data || [])
    } catch (error) {
        logger.error('Error in GET /api/prompt-library:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/prompt-library — Create a new prompt
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId, userName } = auth

        const body = await req.json()
        const { title, content, description, category, type, access_level, tags, variables, source_references, rules } = body

        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
        }

        // Get user's org_id
        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        const { data, error } = await supabase
            .from('prompt_library')
            .insert({
                title: title.trim(),
                content: content.trim(),
                description: description?.trim() || null,
                category: category || 'General',
                type: type || 'prompt',
                access_level: access_level || 'private',
                tags: tags || [],
                variables: variables || [],
                source_references: source_references || [],
                rules: rules || [],
                user_id: userId,
                org_id: membership?.org_id || null,
                created_by_name: userName,
                usage_count: 0,
                is_pinned: false,
            })
            .select()
            .single()

        if (error) {
            logger.error('Error creating prompt:', 'Error', error)
            return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 })
        }

        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        logger.error('Error in POST /api/prompt-library:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
