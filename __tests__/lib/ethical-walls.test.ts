import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invalidateWallCache } from '@/lib/ethical-walls'

// Mock supabase — simulate the three tables ethical walls queries
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()

const createChain = () => ({
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    in: mockIn.mockReturnThis(),
})

vi.mock('@/lib/supabase/server', () => ({
    supabase: {
        from: vi.fn(() => createChain()),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}))

import { supabase } from '@/lib/supabase/server'

beforeEach(() => {
    vi.clearAllMocks()
    invalidateWallCache('org-1') // Clear cache between tests
})

describe('getBlockedProjectIds', () => {
    it('returns empty array when no active walls exist', async () => {
        // Setup: no active walls
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        const { getBlockedProjectIds } = await import('@/lib/ethical-walls')
        const result = await getBlockedProjectIds('org-1', 'user-1')
        expect(result).toEqual([])
    })

    it('returns empty when user is member of all walls', async () => {
        // Wall exists, user is in it
        let callCount = 0
        vi.mocked(supabase.from).mockImplementation(() => {
            callCount++
            if (callCount === 1) {
                // ethical_walls query
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [{ id: 'wall-1' }],
                                error: null,
                            }),
                        }),
                    }),
                } as any // eslint-disable-line @typescript-eslint/no-explicit-any
            }
            if (callCount === 2) {
                // ethical_wall_members query — user IS a member
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({
                                data: [{ wall_id: 'wall-1' }],
                                error: null,
                            }),
                        }),
                    }),
                } as any // eslint-disable-line @typescript-eslint/no-explicit-any
            }
            return createChain() as any // eslint-disable-line @typescript-eslint/no-explicit-any
        })

        const { getBlockedProjectIds } = await import('@/lib/ethical-walls')
        invalidateWallCache('org-1')
        const result = await getBlockedProjectIds('org-1', 'user-1')
        expect(result).toEqual([])
    })
})

describe('isProjectBlocked', () => {
    it('delegates to getBlockedProjectIds', async () => {
        // Setup: no walls at all
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        const { isProjectBlocked } = await import('@/lib/ethical-walls')
        invalidateWallCache('org-1')
        const blocked = await isProjectBlocked('org-1', 'user-1', 'project-1')
        expect(blocked).toBe(false)
    })
})

describe('invalidateWallCache', () => {
    it('can be called without error (cache management)', () => {
        // Should never throw, even if no cache entries exist
        expect(() => invalidateWallCache('nonexistent-org')).not.toThrow()
    })
})
