import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('@/lib/auth/permissions', () => ({
    checkPermission: vi.fn(),
    checkProjectAccess: vi.fn(),
}))

vi.mock('@/lib/auth/org', () => ({
    getOrgForProject: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}))

import { extractGuardContext, requirePermission, requireProjectAccess } from '@/lib/auth/guards'
import { checkPermission } from '@/lib/auth/permissions'
import { getOrgForProject } from '@/lib/auth/org'

// Helper to build a mock NextRequest
function mockRequest(headers: Record<string, string> = {}, pathname = '/api/test') {
    return {
        headers: {
            get: (key: string) => headers[key] || null,
        },
        nextUrl: { pathname },
    } as any // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeEach(() => {
    vi.clearAllMocks()
})

// ─── extractGuardContext ────────────────────────────────────────

describe('extractGuardContext', () => {
    it('extracts userId and orgId from headers', () => {
        const req = mockRequest({ 'x-user-id': 'u1', 'x-org-id': 'o1' })
        const ctx = extractGuardContext(req, 'p1')

        expect(ctx).toEqual({ userId: 'u1', orgId: 'o1', projectId: 'p1' })
    })

    it('returns nulls when headers are missing', () => {
        const req = mockRequest()
        const ctx = extractGuardContext(req)

        expect(ctx).toEqual({ userId: null, orgId: null, projectId: null })
    })

    it('uses provided projectId parameter', () => {
        const req = mockRequest()
        const ctx = extractGuardContext(req, 'proj-123')

        expect(ctx.projectId).toBe('proj-123')
    })
})

// ─── requirePermission ─────────────────────────────────────────

describe('requirePermission', () => {
    it('soft-allows when userId is missing (pre-Auth0)', async () => {
        const req = mockRequest({})

        const { authorized } = await requirePermission(req, 'org:view')

        expect(authorized).toBe(true)
    })

    it('checks permission when both userId and orgId are present', async () => {
        vi.mocked(checkPermission).mockResolvedValue(true)
        const req = mockRequest({ 'x-user-id': 'u1', 'x-org-id': 'o1' })

        const { authorized, context } = await requirePermission(req, 'project:edit')

        expect(authorized).toBe(true)
        expect(checkPermission).toHaveBeenCalledWith('u1', 'o1', 'project:edit')
        expect(context.userId).toBe('u1')
    })

    it('denies access when permission check fails', async () => {
        vi.mocked(checkPermission).mockResolvedValue(false)
        const req = mockRequest({ 'x-user-id': 'u1', 'x-org-id': 'o1' })

        const { authorized } = await requirePermission(req, 'admin')

        expect(authorized).toBe(false)
    })

    it('derives orgId from projectId when orgId is missing', async () => {
        vi.mocked(getOrgForProject).mockResolvedValue('derived-org')
        vi.mocked(checkPermission).mockResolvedValue(true)
        const req = mockRequest({ 'x-user-id': 'u1' })

        const { authorized, context } = await requirePermission(req, 'project:view', 'proj-1')

        expect(getOrgForProject).toHaveBeenCalledWith('proj-1')
        expect(context.orgId).toBe('derived-org')
        expect(authorized).toBe(true)
    })
})

// ─── requireProjectAccess ───────────────────────────────────────

describe('requireProjectAccess', () => {
    it('soft-allows when userId is missing', async () => {
        const req = mockRequest({})

        const { authorized } = await requireProjectAccess(req, 'proj-1')

        expect(authorized).toBe(true)
    })

    it('always returns authorized true (soft enforcement)', async () => {
        const { checkProjectAccess } = await import('@/lib/auth/permissions')
        vi.mocked(checkProjectAccess).mockResolvedValue(false)
        const req = mockRequest({ 'x-user-id': 'u1' })

        // Even when checkProjectAccess returns false, soft enforcement allows through
        const { authorized } = await requireProjectAccess(req, 'proj-1')

        expect(authorized).toBe(true)
    })
})
