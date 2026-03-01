import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
const mockSingle = vi.fn()
const mockLimit = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ eq: mockEq, limit: mockLimit }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('@/lib/supabase/server', () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
    },
}))

import { checkPermission, checkProjectAccess } from '@/lib/auth/permissions'

beforeEach(() => {
    vi.clearAllMocks()
    // Reset the chain mocks
    mockEq.mockReturnValue({ eq: mockEq, limit: mockLimit })
    mockLimit.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
})

// ─── checkPermission ────────────────────────────────────────────

describe('checkPermission', () => {
    it('returns false when userId is empty', async () => {
        expect(await checkPermission('', 'org-1', 'org:view')).toBe(false)
    })

    it('returns false when orgId is empty', async () => {
        expect(await checkPermission('user-1', '', 'org:view')).toBe(false)
    })

    it('returns true when user has correct role with the permission', async () => {
        mockSingle.mockResolvedValue({ data: { role: 'owner' }, error: null })

        const result = await checkPermission('user-1', 'org-1', 'admin')

        expect(result).toBe(true)
        expect(mockFrom).toHaveBeenCalledWith('organization_members')
    })

    it('returns false when user role does not have the permission', async () => {
        mockSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })

        const result = await checkPermission('user-1', 'org-1', 'project:edit')

        expect(result).toBe(false)
    })

    it('returns false when supabase query errors', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

        const result = await checkPermission('user-1', 'org-1', 'org:view')

        expect(result).toBe(false)
    })
})

// ─── checkProjectAccess ─────────────────────────────────────────

describe('checkProjectAccess', () => {
    it('returns false when userId is empty', async () => {
        expect(await checkProjectAccess('', 'proj-1')).toBe(false)
    })

    it('returns false when projectId is empty', async () => {
        expect(await checkProjectAccess('user-1', '')).toBe(false)
    })

    it('returns false when project query fails', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

        const result = await checkProjectAccess('user-1', 'proj-1')

        expect(result).toBe(false)
    })
})
