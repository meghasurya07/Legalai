import { auth0 } from '@/lib/auth0'

/**
 * Retrieves the Auth0 user ID (sub) from the current session.
 * Returns the user_id string or null if not authenticated.
 */
export async function getUserId(): Promise<string | null> {
    try {
        const session = await auth0.getSession()
        return session?.user?.sub || null
    } catch {
        return null
    }
}
