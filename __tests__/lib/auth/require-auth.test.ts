import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth0
const mockGetSession = vi.fn()

vi.mock('@/lib/auth/auth0', () => ({
    auth0: {
        getSession: () => mockGetSession(),
    },
}))

// Mock logger (apiError calls logger.error internally)
vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}))

import { requireAuth, type AuthResult } from '@/lib/auth/require-auth'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('requireAuth', () => {
    it('returns AuthResult with userId, userName, userEmail when authenticated', async () => {
        mockGetSession.mockResolvedValue({
            user: {
                sub: 'auth0|user-123',
                name: 'John Doe',
                email: 'john@example.com',
            },
        })

        const result = await requireAuth()

        // Should NOT be a Response
        expect(result).not.toBeInstanceOf(Response)

        const auth = result as AuthResult
        expect(auth.userId).toBe('auth0|user-123')
        expect(auth.userName).toBe('John Doe')
        expect(auth.userEmail).toBe('john@example.com')
    })

    it('returns 401 Response when session is null', async () => {
        mockGetSession.mockResolvedValue(null)

        const result = await requireAuth()

        expect(result).toBeInstanceOf(Response)
        const res = result as Response
        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.success).toBe(false)
        expect(body.error.code).toBe(401)
        expect(body.error.message).toBe('Unauthorized')
    })

    it('returns 401 Response when session has no user', async () => {
        mockGetSession.mockResolvedValue({})

        const result = await requireAuth()

        expect(result).toBeInstanceOf(Response)
        expect((result as Response).status).toBe(401)
    })

    it('returns 401 Response when user has no sub', async () => {
        mockGetSession.mockResolvedValue({
            user: { name: 'No Sub User', email: 'nosub@example.com' },
        })

        const result = await requireAuth()

        expect(result).toBeInstanceOf(Response)
        expect((result as Response).status).toBe(401)
    })

    it('falls back to email for userName when name is missing', async () => {
        mockGetSession.mockResolvedValue({
            user: { sub: 'auth0|u2', email: 'fallback@example.com' },
        })

        const auth = (await requireAuth()) as AuthResult
        expect(auth.userName).toBe('fallback@example.com')
    })

    it('falls back to "Unknown" when both name and email are missing', async () => {
        mockGetSession.mockResolvedValue({
            user: { sub: 'auth0|u3' },
        })

        const auth = (await requireAuth()) as AuthResult
        expect(auth.userName).toBe('Unknown')
        expect(auth.userEmail).toBe('')
    })
})
