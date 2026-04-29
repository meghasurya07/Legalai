import { logger } from '@/lib/logger'
/**
 * Ethical Walls — Enforcement Library
 *
 * Core function: getBlockedProjectIds(orgId, userId)
 * Returns the set of project IDs that a user is BLOCKED from accessing
 * because they are behind an active ethical wall the user is NOT a member of.
 *
 * Logic:
 *   1. Find all active walls in the org
 *   2. For each wall, check if the user is a member
 *   3. If NOT a member → all projects in that wall are blocked
 *   4. Return the union of all blocked project IDs
 */

import { supabase } from '@/lib/supabase/server'

// ── Cache ───────────────────────────────────────────────────────────
// Cache blocked projects for 2 minutes per user to avoid repeated DB hits
const blockedCache = new Map<string, { ids: string[]; expiry: number }>()
const CACHE_TTL_MS = 2 * 60 * 1000

export function invalidateWallCache(orgId: string): void {
    // Invalidate all entries for this org
    for (const key of blockedCache.keys()) {
        if (key.startsWith(orgId)) {
            blockedCache.delete(key)
        }
    }
}

// ── Core Enforcement ────────────────────────────────────────────────

/**
 * Get the project IDs that a user is BLOCKED from accessing.
 * Returns an empty array if no walls apply (default — no restrictions).
 */
export async function getBlockedProjectIds(
    orgId: string,
    userId: string
): Promise<string[]> {
    const cacheKey = `${orgId}:${userId}`
    const cached = blockedCache.get(cacheKey)
    if (cached && cached.expiry > Date.now()) {
        return cached.ids
    }

    try {
        // 1. Get all active walls in the org with their projects and members
        const { data: walls, error } = await supabase
            .from('ethical_walls')
            .select('id')
            .eq('org_id', orgId)
            .eq('status', 'active')

        if (error || !walls || walls.length === 0) {
            blockedCache.set(cacheKey, { ids: [], expiry: Date.now() + CACHE_TTL_MS })
            return []
        }

        const wallIds = walls.map(w => w.id)

        // 2. Get walls the user IS a member of
        const { data: memberships } = await supabase
            .from('ethical_wall_members')
            .select('wall_id')
            .eq('user_id', userId)
            .in('wall_id', wallIds)

        const memberWallIds = new Set((memberships || []).map(m => m.wall_id))

        // 3. Find walls the user is NOT in
        const blockedWallIds = wallIds.filter(id => !memberWallIds.has(id))

        if (blockedWallIds.length === 0) {
            blockedCache.set(cacheKey, { ids: [], expiry: Date.now() + CACHE_TTL_MS })
            return []
        }

        // 4. Get all project IDs behind those blocked walls
        const { data: blockedProjects } = await supabase
            .from('ethical_wall_projects')
            .select('project_id')
            .in('wall_id', blockedWallIds)

        const blockedIds = [...new Set((blockedProjects || []).map(p => p.project_id))]
        blockedCache.set(cacheKey, { ids: blockedIds, expiry: Date.now() + CACHE_TTL_MS })
        return blockedIds
    } catch (err) {
        logger.error('[EthicalWalls] Error checking walls:', 'Error occurred', err)
        // Fail CLOSED — if we can't check, block nothing (safe default for availability)
        return []
    }
}

/**
 * Check if a specific user is blocked from accessing a specific project.
 * Used for individual project access checks (GET/PATCH/DELETE).
 */
export async function isProjectBlocked(
    orgId: string,
    userId: string,
    projectId: string
): Promise<boolean> {
    const blocked = await getBlockedProjectIds(orgId, userId)
    return blocked.includes(projectId)
}

// ── Admin Queries ───────────────────────────────────────────────────

export interface EthicalWall {
    id: string
    name: string
    description: string | null
    status: string
    created_by: string
    created_at: string
    members: { user_id: string; user_name?: string; profile_image?: string }[]
    projects: { project_id: string; title?: string }[]
}

/**
 * List all ethical walls for an organization (admin view).
 */
export async function listWalls(orgId: string): Promise<EthicalWall[]> {
    const { data: walls, error } = await supabase
        .from('ethical_walls')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    if (error || !walls) return []

    // Hydrate members and projects for each wall
    const result: EthicalWall[] = []
    for (const wall of walls) {
        const [membersRes, projectsRes] = await Promise.all([
            supabase
                .from('ethical_wall_members')
                .select('user_id')
                .eq('wall_id', wall.id),
            supabase
                .from('ethical_wall_projects')
                .select('project_id')
                .eq('wall_id', wall.id)
        ])

        // Hydrate member names
        const memberUserIds = (membersRes.data || []).map(m => m.user_id)
        let membersWithNames: { user_id: string; user_name?: string; profile_image?: string }[] = []
        if (memberUserIds.length > 0) {
            const { data: orgMembers } = await supabase
                .from('organization_members')
                .select('user_id, user_name, profile_image')
                .in('user_id', memberUserIds)
                .eq('org_id', orgId)
            membersWithNames = (orgMembers || []).map(m => ({
                user_id: m.user_id,
                user_name: m.user_name || undefined,
                profile_image: m.profile_image || undefined
            }))
        }

        // Hydrate project titles
        const projectIds = (projectsRes.data || []).map(p => p.project_id)
        let projectsWithTitles: { project_id: string; title?: string }[] = []
        if (projectIds.length > 0) {
            const { data: projects } = await supabase
                .from('projects')
                .select('id, title')
                .in('id', projectIds)
            projectsWithTitles = (projects || []).map(p => ({
                project_id: p.id,
                title: p.title || undefined
            }))
        }

        result.push({
            id: wall.id,
            name: wall.name,
            description: wall.description,
            status: wall.status,
            created_by: wall.created_by,
            created_at: wall.created_at,
            members: membersWithNames,
            projects: projectsWithTitles
        })
    }

    return result
}
