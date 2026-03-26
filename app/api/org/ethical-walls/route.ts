/**
 * Ethical Walls API Route
 *
 * CRUD operations for managing ethical walls (information barriers).
 * Admin/Owner only — enforced via org context + role check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { invalidateWallCache, listWalls } from '@/lib/ethical-walls'

// ── GET: List all walls ─────────────────────────────────────────────

export async function GET() {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Only admins and owners can view walls
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const walls = await listWalls(ctx.orgId)
        return NextResponse.json({ success: true, data: walls })
    } catch (error) {
        console.error('[EthicalWalls] GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch walls' }, { status: 500 })
    }
}

// ── POST: Create a new wall ─────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await request.json()
        const { name, description, memberUserIds, projectIds } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Wall name is required' }, { status: 400 })
        }
        if (!memberUserIds?.length) {
            return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
        }
        if (!projectIds?.length) {
            return NextResponse.json({ error: 'At least one project is required' }, { status: 400 })
        }

        // 1. Create the wall
        const { data: wall, error: wallError } = await supabase
            .from('ethical_walls')
            .insert({
                org_id: ctx.orgId,
                name: name.trim(),
                description: description?.trim() || null,
                created_by: ctx.userId
            })
            .select()
            .single()

        if (wallError || !wall) {
            return NextResponse.json({ error: 'Failed to create wall' }, { status: 500 })
        }

        // 2. Add members
        const memberInserts = memberUserIds.map((uid: string) => ({
            wall_id: wall.id,
            user_id: uid
        }))
        await supabase.from('ethical_wall_members').insert(memberInserts)

        // 3. Add projects
        const projectInserts = projectIds.map((pid: string) => ({
            wall_id: wall.id,
            project_id: pid
        }))
        await supabase.from('ethical_wall_projects').insert(projectInserts)

        // 4. Invalidate cache for the entire org
        invalidateWallCache(ctx.orgId)

        // 5. Audit log
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'ethical_wall.created',
            target_entity: 'ethical_wall',
            target_id: wall.id,
            metadata: {
                name: wall.name,
                memberCount: memberUserIds.length,
                projectCount: projectIds.length
            }
        })

        return NextResponse.json({ success: true, data: { id: wall.id } }, { status: 201 })
    } catch (error) {
        console.error('[EthicalWalls] POST error:', error)
        return NextResponse.json({ error: 'Failed to create wall' }, { status: 500 })
    }
}

// ── PUT: Update a wall ──────────────────────────────────────────────

export async function PUT(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await request.json()
        const { wallId, name, description, status, memberUserIds, projectIds } = body

        if (!wallId) {
            return NextResponse.json({ error: 'Wall ID is required' }, { status: 400 })
        }

        // Verify wall belongs to this org
        const { data: wall } = await supabase
            .from('ethical_walls')
            .select('id, org_id')
            .eq('id', wallId)
            .eq('org_id', ctx.orgId)
            .single()

        if (!wall) {
            return NextResponse.json({ error: 'Wall not found' }, { status: 404 })
        }

        // Update wall metadata
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (name !== undefined) updates.name = name.trim()
        if (description !== undefined) updates.description = description?.trim() || null
        if (status !== undefined) updates.status = status

        await supabase.from('ethical_walls').update(updates).eq('id', wallId)

        // Update members if provided
        if (memberUserIds !== undefined) {
            await supabase.from('ethical_wall_members').delete().eq('wall_id', wallId)
            if (memberUserIds.length > 0) {
                await supabase.from('ethical_wall_members').insert(
                    memberUserIds.map((uid: string) => ({ wall_id: wallId, user_id: uid }))
                )
            }
        }

        // Update projects if provided
        if (projectIds !== undefined) {
            await supabase.from('ethical_wall_projects').delete().eq('wall_id', wallId)
            if (projectIds.length > 0) {
                await supabase.from('ethical_wall_projects').insert(
                    projectIds.map((pid: string) => ({ wall_id: wallId, project_id: pid }))
                )
            }
        }

        invalidateWallCache(ctx.orgId)

        // Audit
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'ethical_wall.updated',
            target_entity: 'ethical_wall',
            target_id: wallId,
            metadata: { changes: Object.keys(updates) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[EthicalWalls] PUT error:', error)
        return NextResponse.json({ error: 'Failed to update wall' }, { status: 500 })
    }
}

// ── DELETE: Remove a wall ───────────────────────────────────────────

export async function DELETE(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const wallId = searchParams.get('wallId')

        if (!wallId) {
            return NextResponse.json({ error: 'Wall ID is required' }, { status: 400 })
        }

        // Verify wall belongs to this org
        const { data: wall } = await supabase
            .from('ethical_walls')
            .select('id, name, org_id')
            .eq('id', wallId)
            .eq('org_id', ctx.orgId)
            .single()

        if (!wall) {
            return NextResponse.json({ error: 'Wall not found' }, { status: 404 })
        }

        // Delete (cascade removes members and projects)
        await supabase.from('ethical_walls').delete().eq('id', wallId)

        invalidateWallCache(ctx.orgId)

        // Audit
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'ethical_wall.deleted',
            target_entity: 'ethical_wall',
            target_id: wallId,
            metadata: { name: wall.name }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[EthicalWalls] DELETE error:', error)
        return NextResponse.json({ error: 'Failed to delete wall' }, { status: 500 })
    }
}
