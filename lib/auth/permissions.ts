/**
 * Access Control — Permission Checker
 * 
 * Verifies a user has the required permission within an organization.
 */

import { supabase } from '@/lib/supabase/server'
import { roleHasPermission } from './roles'
import type { OrgRole, Permission } from './types'

/**
 * Check if a user has a specific permission in an organization.
 * Returns true if the user has the membership + role that grants the permission.
 */
export async function checkPermission(
    userId: string,
    orgId: string,
    permission: Permission
): Promise<boolean> {
    if (!userId || !orgId) return false

    try {
        const { data, error } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', orgId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1)
            .single()

        if (error || !data) return false

        return roleHasPermission(data.role as OrgRole, permission)
    } catch {
        return false
    }
}

/**
 * Check if a user has access to a specific project through org membership.
 * Verifies org membership and optional team membership.
 */
export async function checkProjectAccess(
    userId: string,
    projectId: string,
    permission: Permission = 'project:view'
): Promise<boolean> {
    if (!userId || !projectId) return false

    try {
        // 1. Get project's org and team
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('organization_id, team_id')
            .eq('id', projectId)
            .limit(1)
            .single()

        if (projErr || !project || !project.organization_id) return false

        // 2. Check org membership
        const hasOrgPermission = await checkPermission(userId, project.organization_id, permission)
        if (!hasOrgPermission) return false

        // 3. If project is team-scoped, verify team membership
        if (project.team_id) {
            const { data: teamMember } = await supabase
                .from('team_members')
                .select('id')
                .eq('team_id', project.team_id)
                .eq('user_id', userId)
                .limit(1)
                .single()

            // Owner/admin bypass team restriction
            const { data: orgMember } = await supabase
                .from('organization_members')
                .select('role')
                .eq('organization_id', project.organization_id)
                .eq('user_id', userId)
                .eq('status', 'active')
                .limit(1)
                .single()

            const isAdminOrOwner = orgMember?.role === 'owner' || orgMember?.role === 'admin'
            if (!teamMember && !isAdminOrOwner) return false
        }

        return true
    } catch {
        return false
    }
}
