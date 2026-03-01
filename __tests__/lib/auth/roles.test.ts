import { describe, it, expect } from 'vitest'
import { roleHasPermission, getPermissionsForRole } from '@/lib/auth/roles'
import type { OrgRole, Permission } from '@/lib/auth/types'

describe('roleHasPermission', () => {
    it('owner has admin permission', () => {
        expect(roleHasPermission('owner', 'admin')).toBe(true)
    })

    it('admin does NOT have admin permission', () => {
        expect(roleHasPermission('admin', 'admin')).toBe(false)
    })

    it('viewer can only view', () => {
        expect(roleHasPermission('viewer', 'org:view')).toBe(true)
        expect(roleHasPermission('viewer', 'project:view')).toBe(true)
        expect(roleHasPermission('viewer', 'project:edit')).toBe(false)
        expect(roleHasPermission('viewer', 'project:create')).toBe(false)
        expect(roleHasPermission('viewer', 'project:delete')).toBe(false)
    })

    it('member can create and edit but not delete', () => {
        expect(roleHasPermission('member', 'project:create')).toBe(true)
        expect(roleHasPermission('member', 'project:edit')).toBe(true)
        expect(roleHasPermission('member', 'project:delete')).toBe(false)
    })

    it('admin can delete projects', () => {
        expect(roleHasPermission('admin', 'project:delete')).toBe(true)
    })

    it('returns false for an invalid role', () => {
        expect(roleHasPermission('unknown_role' as OrgRole, 'org:view')).toBe(false)
    })

    it('returns false for an invalid permission on a valid role', () => {
        expect(roleHasPermission('owner', 'nonexistent:perm' as Permission)).toBe(false)
    })
})

describe('getPermissionsForRole', () => {
    it('returns all owner permissions including admin', () => {
        const perms = getPermissionsForRole('owner')
        expect(perms).toContain('admin')
        expect(perms).toContain('org:manage')
        expect(perms).toContain('project:delete')
    })

    it('returns viewer permissions (no write access)', () => {
        const perms = getPermissionsForRole('viewer')
        expect(perms).toContain('org:view')
        expect(perms).toContain('project:view')
        expect(perms).not.toContain('project:edit')
        expect(perms).not.toContain('org:manage')
    })

    it('returns member permissions (includes workflow:run)', () => {
        const perms = getPermissionsForRole('member')
        expect(perms).toContain('workflow:run')
        expect(perms).toContain('vault:upload')
    })

    it('returns empty array for invalid role', () => {
        const perms = getPermissionsForRole('fake' as OrgRole)
        expect(perms).toEqual([])
    })
})
