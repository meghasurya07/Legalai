/**
 * Access Control — Organization Helpers
 * 
 * Utility functions for org operations.
 */

import { supabase } from '@/lib/supabase/server'
import type { Organization, OrgMember } from './types'
import { logger } from '@/lib/logger'

/**
 * Get all orgs a user belongs to.
 */
export async function getUserOrgs(userId: string): Promise<Organization[]> {
    if (!userId) return []

    const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, name, slug, created_by, created_at)')
        .eq('user_id', userId)
        .eq('status', 'active')

    if (error || !data) return []

    return data
        .map(d => {
            const org = d.organizations as unknown as Organization | null
            return org
        })
        .filter((o): o is Organization => o !== null)
}

/**
 * Get the organization that owns a project.
 */
export async function getOrgForProject(projectId: string): Promise<string | null> {
    if (!projectId) return null

    const { data, error } = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', projectId)
        .limit(1)
        .single()

    if (error || !data) return null
    return data.organization_id as string | null
}

/**
 * Get members of an organization.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
    const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgId)
        .eq('status', 'active')

    if (error || !data) return []
    return data as unknown as OrgMember[]
}

/**
 * Bootstrap a default organization for a user.
 * Creates org + owner membership if user has no orgs.
 */
export async function bootstrapDefaultOrg(userId: string, orgName: string = 'My Organization'): Promise<string | null> {
    if (!userId) return null

    // Check if user already has an org
    const existing = await getUserOrgs(userId)
    if (existing.length > 0) return existing[0].id

    // Create org
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: orgName, slug: `${slug}-${Date.now()}`, created_by: userId })
        .select('id')
        .single()

    if (orgErr || !org) {
        console.error('[Auth] Failed to create org:', orgErr)
        return null
    }

    // Add user as owner
    await supabase
        .from('organization_members')
        .insert({
            organization_id: org.id,
            user_id: userId,
            role: 'owner',
            status: 'active'
        })

    // Assign unscoped projects to this org
    await supabase
        .from('projects')
        .update({ organization_id: org.id })
        .eq('user_id', userId)
        .is('organization_id', null)

    logger.info("auth/org", `[Auth] Bootstrapped org ${org.id} for user ${userId}`)
    return org.id
}
