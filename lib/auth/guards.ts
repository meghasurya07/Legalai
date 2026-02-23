/**
 * Access Control — API Route Guards
 * 
 * Soft-enforcement middleware for API routes.
 * Logs warnings when org context is missing (pre-Auth0 integration).
 */

import { NextRequest } from 'next/server'
import { checkPermission, checkProjectAccess } from './permissions'
import { getOrgForProject } from './org'
import type { Permission } from './types'

/**
 * Guard context extracted from the request.
 */
export interface GuardContext {
    userId: string | null
    orgId: string | null
    projectId: string | null
}

/**
 * Extract auth context from request headers/params.
 * Pre-Auth0: reads from custom headers or query params.
 */
export function extractGuardContext(req: NextRequest, projectId?: string): GuardContext {
    const userId = req.headers.get('x-user-id') || null
    const orgId = req.headers.get('x-org-id') || null
    return { userId, orgId, projectId: projectId || null }
}

/**
 * Require a permission for an API route.
 * Soft-enforced: logs warning and allows through if org context is missing.
 * Returns { authorized, context } so routes can use context downstream.
 */
export async function requirePermission(
    req: NextRequest,
    permission: Permission,
    projectId?: string
): Promise<{ authorized: boolean; context: GuardContext }> {
    const context = extractGuardContext(req, projectId)

    // Pre-Auth0: soft enforcement
    if (!context.userId || !context.orgId) {
        // Try to derive org from project
        if (projectId && !context.orgId) {
            const derivedOrg = await getOrgForProject(projectId)
            if (derivedOrg) context.orgId = derivedOrg
        }

        if (!context.userId) {
            console.warn(`[Guard] Missing userId for ${permission} on ${req.nextUrl.pathname}`)
            return { authorized: true, context } // Soft: allow through
        }
    }

    // If we have both userId and orgId, enforce properly
    if (context.userId && context.orgId) {
        const allowed = await checkPermission(context.userId, context.orgId, permission)
        if (!allowed) {
            console.warn(`[Guard] Permission denied: ${context.userId} lacks ${permission} in org ${context.orgId}`)
            return { authorized: false, context }
        }
    }

    return { authorized: true, context }
}

/**
 * Require project access for an API route.
 * Soft-enforced pre-Auth0.
 */
export async function requireProjectAccess(
    req: NextRequest,
    projectId: string,
    permission: Permission = 'project:view'
): Promise<{ authorized: boolean; context: GuardContext }> {
    const context = extractGuardContext(req, projectId)

    if (!context.userId) {
        console.warn(`[Guard] Missing userId for project access on ${req.nextUrl.pathname}`)
        return { authorized: true, context } // Soft: allow through
    }

    const allowed = await checkProjectAccess(context.userId, projectId, permission)
    if (!allowed) {
        // Soft: allow through but warn
        console.warn(`[Guard] Project access warning: ${context.userId} → ${projectId} (${permission})`)
    }

    return { authorized: true, context }
}
