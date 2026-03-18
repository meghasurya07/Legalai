/**
 * Simple in-memory rate limiter for API routes.
 * 
 * Uses a sliding window approach per identifier (typically userId).
 * For production at scale, replace with Redis-backed rate limiting.
 */

interface RateLimitEntry {
    count: number
    resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
        if (now > entry.resetAt) {
            store.delete(key)
        }
    }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number
    /** Window duration in seconds */
    windowSeconds: number
}

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetAt: number
}

/**
 * Check and consume a rate limit for the given key.
 * Returns whether the request is allowed and how many remain.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const windowMs = config.windowSeconds * 1000
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
        // New window
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + windowMs }
    }

    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

// ── Preset rate limit configurations ──────────────────────────

/** Standard AI routes: 30 requests per minute per user */
export const RATE_LIMIT_AI: RateLimitConfig = { maxRequests: 30, windowSeconds: 60 }

/** Chat route: 20 messages per minute per user */
export const RATE_LIMIT_CHAT: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 }

/** Heavy AI routes (batch extraction, deep research): 10 per minute */
export const RATE_LIMIT_HEAVY: RateLimitConfig = { maxRequests: 10, windowSeconds: 60 }

/** File uploads: 20 per minute per user */
export const RATE_LIMIT_UPLOAD: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 }

/** Login/auth attempts: 10 per minute per IP */
export const RATE_LIMIT_AUTH: RateLimitConfig = { maxRequests: 10, windowSeconds: 60 }

/** Global API: 120 requests per minute per user (hard ceiling) */
export const RATE_LIMIT_GLOBAL: RateLimitConfig = { maxRequests: 120, windowSeconds: 60 }
