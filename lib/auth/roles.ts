/**
 * Access Control — Role → Permission Mapping
 */

import type { OrgRole, Permission } from './types'

/**
 * Permissions granted to each organization role.
 */
const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
    owner: [
        'org:manage', 'org:view',
        'team:manage',
        'project:create', 'project:view', 'project:edit', 'project:delete',
        'vault:view', 'vault:upload',
        'workflow:run', 'workflow:view',
        'insight:view',
        'admin'
    ],

    admin: [
        'org:view',
        'team:manage',
        'project:create', 'project:view', 'project:edit', 'project:delete',
        'vault:view', 'vault:upload',
        'workflow:run', 'workflow:view',
        'insight:view'
    ],

    member: [
        'org:view',
        'project:create', 'project:view', 'project:edit',
        'vault:view', 'vault:upload',
        'workflow:run', 'workflow:view',
        'insight:view'
    ],

    viewer: [
        'org:view',
        'project:view',
        'vault:view',
        'workflow:view',
        'insight:view'
    ]
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: OrgRole): Permission[] {
    return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(role: OrgRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
