import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth0
const mockGetSession = vi.fn()

vi.mock('@/lib/auth/auth0', () => ({
    auth0: {
        getSession: () => mockGetSession(),
    },
}))

import { getUserId } from '@/lib/auth/get-user-id'
import { logger } from '@/lib/logger'

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(logger, 'error').mockImplementation(() => {})
})

describe('getUserId', () => {
    it('returns the user sub when authenticated', async () => {
        mockGetSession.mockResolvedValue({
            user: { sub: 'auth0|user123' },
        })

        const id = await getUserId()
        expect(id).toBe('auth0|user123')
    })

    it('returns null when session has no user', async () => {
        mockGetSession.mockResolvedValue({})

        const id = await getUserId()
        expect(id).toBeNull()
    })

    it('returns null when session is null', async () => {
        mockGetSession.mockResolvedValue(null)

        const id = await getUserId()
        expect(id).toBeNull()
    })

    it('returns null when getSession throws', async () => {
        mockGetSession.mockRejectedValue(new Error('Session error'))

        const id = await getUserId()
        expect(id).toBeNull()
    })
})
