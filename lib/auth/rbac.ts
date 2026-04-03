/**
 * Centralized RBAC Permission Engine
 * 
 * Defines all actions and which roles can perform them.
 * Used by API routes to enforce authorization.
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export type Action =
    | 'manage_org'
    | 'delete_org'
    | 'manage_billing'
    | 'invite_users'
    | 'remove_users'
    | 'change_roles'
    | 'create_team'
    | 'manage_team'
    | 'create_project'
    | 'manage_documents'
    | 'run_workflows'
    | 'use_assistant'
    | 'view_documents'
    | 'view_insights'
    | 'view_audit_log'

/**
 * Permission matrix: role → allowed actions
 */
const PERMISSIONS: Record<OrgRole, Set<Action>> = {
    owner: new Set([
        'manage_org', 'delete_org', 'manage_billing',
        'invite_users', 'remove_users', 'change_roles',
        'create_team', 'manage_team',
        'create_project', 'manage_documents', 'run_workflows', 'use_assistant',
        'view_documents', 'view_insights', 'view_audit_log'
    ]),
    admin: new Set([
        'manage_org',
        'invite_users', 'remove_users', 'change_roles',
        'create_team', 'manage_team',
        'create_project', 'manage_documents', 'run_workflows', 'use_assistant',
        'view_documents', 'view_insights', 'view_audit_log'
    ]),
    member: new Set([
        'create_project', 'manage_documents', 'run_workflows', 'use_assistant',
        'view_documents', 'view_insights'
    ]),
    viewer: new Set([
        'view_documents', 'view_insights'
    ])
}

/**
 * Check if a role has permission to perform an action.
 */
export function checkPermission(role: string | null, action: Action): boolean {
    if (!role) return false
    const allowed = PERMISSIONS[role as OrgRole]
    if (!allowed) return false
    return allowed.has(action)
}

/**
 * Returns true if the role is admin or owner (can manage org).
 */
export function canManage(role: string | null): boolean {
    return role === 'owner' || role === 'admin'
}

/**
 * Role hierarchy for comparison (higher = more power).
 */
const ROLE_HIERARCHY: Record<OrgRole, number> = {
    viewer: 0,
    member: 1,
    admin: 2,
    owner: 3
}

/**
 * Check if actorRole outranks targetRole (e.g., for role changes).
 */
export function outranks(actorRole: string, targetRole: string): boolean {
    const actor = ROLE_HIERARCHY[actorRole as OrgRole] ?? -1
    const target = ROLE_HIERARCHY[targetRole as OrgRole] ?? -1
    return actor > target
}
