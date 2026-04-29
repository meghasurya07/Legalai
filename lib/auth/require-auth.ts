import { auth0 } from '@/lib/auth/auth0'
import { apiError } from '@/lib/api-utils'

/**
 * Auth result returned on successful authentication.
 */
export interface AuthResult {
    userId: string
    userName: string
    userEmail: string
}

/**
 * Authenticate the current request.
 *
 * Returns an `AuthResult` on success, or a ready-to-return `Response` (401)
 * on failure.  Usage:
 *
 * ```ts
 * const auth = await requireAuth()
 * if (auth instanceof Response) return auth
 * const { userId, userName } = auth
 * ```
 */
export async function requireAuth(): Promise<AuthResult | Response> {
    const session = await auth0.getSession()
    if (!session?.user?.sub) {
        return apiError('Unauthorized', 401)
    }
    return {
        userId: session.user.sub,
        userName: session.user.name || session.user.email || 'Unknown',
        userEmail: session.user.email || '',
    }
}
