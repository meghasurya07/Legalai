/**
 * Super Admin Guard
 * 
 * Checks if the current user is a platform super admin
 * by matching their Auth0 email against the SUPER_ADMIN_EMAILS env variable.
 */

import { auth0 } from '@/lib/auth0'

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

export function isSuperAdmin(email: string | undefined | null): boolean {
    if (!email) return false
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function requireSuperAdmin(): Promise<{ userId: string; email: string } | null> {
    try {
        const session = await auth0.getSession()
        if (!session?.user) return null

        const email = session.user.email || ''
        if (!email || !isSuperAdmin(email)) return null

        return {
            userId: session.user.sub,
            email
        }
    } catch {
        return null
    }
}
