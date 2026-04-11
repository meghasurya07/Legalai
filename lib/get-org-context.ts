/**
 * Organization Context Resolver (Server-Side)
 *
 * Resolves the current user's org_id and role from their session.
 * Used by all API routes to enforce tenant isolation.
 * 
 * BACKWARD COMPATIBLE: Returns null gracefully if org tables don't exist yet
 * (i.e., migrations haven't been run). Callers should fall back to user_id-only.
 */

import { supabase } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth/get-user-id'
import { logger } from '@/lib/logger'

export interface OrgContext {
    userId: string
    orgId: string
    role: string
    /** Set to a redirect URL when the user should be redirected (e.g., SSO denied) */
    redirectTo?: string
}

/**
 * Resolve the current user's organization context.
 * Returns null if:
 * - User is not authenticated
 * - Org tables don't exist yet (pre-migration)
 * - User has no org membership and no matching SSO domain
 */
export async function getOrgContext(): Promise<OrgContext | null> {
    try {
        const userId = await getUserId()
        if (!userId) return null

        // 1. Check user_settings for default_org_id
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('default_org_id')
            .eq('user_id', userId)
            .single()

        let orgId = userSettings?.default_org_id

        // 2. Find membership for that org (or any org)
        let membership
        if (orgId) {
            const { data, error } = await supabase
                .from('organization_members')
                .select('org_id, role')
                .eq('user_id', userId)
                .eq('org_id', orgId)
                .single()

            // If table doesn't exist, return null gracefully
            if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.code === '42P01')) {
                return null
            }
            membership = data
        }

        // 3. Fallback: first org the user belongs to
        if (!membership) {
            const { data, error } = await supabase
                .from('organization_members')
                .select('org_id, role')
                .eq('user_id', userId)
                .order('joined_at', { ascending: true })
                .limit(1)
                .single()

            // If table doesn't exist, return null gracefully
            if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.code === '42P01')) {
                return null
            }
            membership = data
            if (membership) {
                orgId = membership.org_id
            }
        }

        // 4. If user has membership, return their context
        if (membership && orgId) {
            return {
                userId,
                orgId,
                role: membership.role
            }
        }

        // 5. SSO JIT Provisioning: if user has no org, try to match by SSO domain
        if (!membership || !orgId) {
            try {
                const session = await (await import('@/lib/auth/auth0')).auth0.getSession()
                const email = session?.user?.email
                if (email && email.includes('@')) {
                    const emailDomain = email.split('@')[1].toLowerCase()

                    // Find an org with this SSO domain
                    const { data: ssoOrg } = await supabase
                        .from('organizations')
                        .select('id, name, status, member_count, licensed_seats')
                        .eq('sso_domain', emailDomain)
                        .limit(1)
                        .single()

                    if (ssoOrg) {
                        // Check org is active
                        if (ssoOrg.status !== 'active') {
                            console.warn(`[SSO JIT] Org ${ssoOrg.name} is ${ssoOrg.status}. Denying SSO user: ${email}`)
                            return {
                                userId,
                                orgId: '',
                                role: '',
                                redirectTo: `/sso-denied?reason=inactive&org=${encodeURIComponent(ssoOrg.name)}`
                            }
                        }

                        // Check seat capacity before provisioning
                        const currentMembers = ssoOrg.member_count || 0
                        const maxSeats = ssoOrg.licensed_seats || 10
                        if (currentMembers >= maxSeats) {
                            console.warn(`[SSO JIT] Seat limit reached for org ${ssoOrg.name} (${currentMembers}/${maxSeats}). Denying SSO user: ${email}`)
                            return {
                                userId,
                                orgId: '',
                                role: '',
                                redirectTo: `/sso-denied?reason=seat_limit&org=${encodeURIComponent(ssoOrg.name)}`
                            }
                        }

                        // Auto-create membership
                        const userName = session?.user?.name || session?.user?.nickname || email.split('@')[0]
                        const profileImage = session?.user?.picture || null

                        await supabase.from('organization_members').insert({
                            org_id: ssoOrg.id,
                            organization_id: ssoOrg.id,
                            user_id: userId,
                            role: 'member',
                            user_name: userName,
                            profile_image: profileImage,
                        })

                        // Set default org + profile in user_settings
                        await supabase.from('user_settings').upsert({
                            user_id: userId,
                            default_org_id: ssoOrg.id,
                            user_name: userName,
                            profile_image: profileImage,
                        })

                        // Increment member_count
                        await supabase
                            .from('organizations')
                            .update({ member_count: currentMembers + 1 })
                            .eq('id', ssoOrg.id)

                        // Audit log the JIT provisioning
                        try {
                            await supabase.from('audit_log').insert({
                                org_id: ssoOrg.id,
                                actor_user_id: userId,
                                action: 'member.sso_provisioned',
                                target_entity: 'user',
                                target_id: userId,
                                metadata: { email, domain: emailDomain, org_name: ssoOrg.name },
                            })
                        } catch {
                            // Audit log is best-effort
                        }

                        logger.info("lib/get-org-context", `[SSO JIT] Auto-provisioned user ${email} into org ${ssoOrg.name}`)

                        return {
                            userId,
                            orgId: ssoOrg.id,
                            role: 'member'
                        }
                    } else {
                        // Domain doesn't match any org — redirect to denied page
                        console.warn(`[SSO JIT] No org found for domain: ${emailDomain} (user: ${email})`)
                    }
                }
            } catch (ssoErr) {
                console.warn('[SSO JIT] Auto-provision failed:', ssoErr)
            }
        }

        if (!membership || !orgId) return null

        return {
            userId,
            orgId,
            role: membership.role
        }
    } catch {
        // Gracefully handle any errors (e.g., table doesn't exist)
        return null
    }
}

/**
 * Helper: get org context or return null.
 */
export async function requireOrgContext(): Promise<OrgContext | null> {
    return getOrgContext()
}

/**
 * Auto-provision: create a default org for a new user if they have none.
 * Returns null gracefully if org tables don't exist yet.
 * NOTE: SSO users are handled by JIT provisioning in getOrgContext() — this is
 * only for non-SSO users who sign up directly via email/password.
 */
export async function autoProvisionOrg(userId: string, userName?: string): Promise<OrgContext | null> {
    try {
        // First check if user already has an org — prevents duplicates on concurrent requests
        const { data: existingMember } = await supabase
            .from('organization_members')
            .select('org_id, role')
            .eq('user_id', userId)
            .limit(1)
            .single()

        if (existingMember) {
            return {
                userId,
                orgId: existingMember.org_id,
                role: existingMember.role
            }
        }

        // Check if this is an SSO user (has a matching sso_domain) — DON'T create a personal org
        try {
            const session = await (await import('@/lib/auth/auth0')).auth0.getSession()
            const email = session?.user?.email
            if (email && email.includes('@')) {
                const emailDomain = email.split('@')[1].toLowerCase()
                const { data: ssoOrg } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('sso_domain', emailDomain)
                    .limit(1)
                    .single()
                if (ssoOrg) {
                    // This is an SSO user — they should be provisioned by JIT, not given a personal org
                    return null
                }
            }
        } catch {
            // Non-critical — continue with personal org creation
        }

        const slug = 'org-' + userId.replace(/[^a-z0-9]/gi, '').slice(-12).toLowerCase()
        const orgName = userName ? `${userName}'s Organization` : 'My Organization'

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({
                name: orgName,
                slug,
                created_by_user_id: userId,
                status: 'active',
                member_count: 1
            })
            .select()
            .single()

        if (orgError || !org) {
            // Table doesn't exist yet — not an error, just pre-migration state
            console.warn('[autoProvisionOrg] Org tables not ready:', orgError?.message)
            return null
        }

        // Add user as owner
        await supabase
            .from('organization_members')
            .insert({
                org_id: org.id,
                organization_id: org.id, // For backwards compatibility with existing DB constraints
                user_id: userId,
                role: 'owner',
                user_name: userName || null
            })

        // Set default_org_id in user_settings
        await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                default_org_id: org.id
            })

        return {
            userId,
            orgId: org.id,
            role: 'owner'
        }
    } catch {
        // Gracefully handle missing tables
        return null
    }
}
