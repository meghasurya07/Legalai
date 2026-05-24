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

    // 1. Lazy cleanup of expired entry for the current key
    const entry = store.get(key)
    if (entry && now > entry.resetAt) {
        store.delete(key)
    }

    // 2. Proactive bounded pruning of other expired keys when Map size grows large
    // This runs in the request context but is capped at 10 deletions to keep latency ultra-low.
    if (store.size > 2000) {
        let pruned = 0
        for (const [k, e] of store.entries()) {
            if (now > e.resetAt) {
                store.delete(k)
                pruned++
            }
            if (pruned >= 10) break
        }
    }

    const currentEntry = store.get(key)

    if (!currentEntry) {
        // New window
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + windowMs }
    }

    if (currentEntry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: currentEntry.resetAt }
    }

    currentEntry.count++
    return { allowed: true, remaining: config.maxRequests - currentEntry.count, resetAt: currentEntry.resetAt }
}

// ── Preset rate limit configurations ──────────────────────────

/** Standard AI routes: 30 requests per minute per user */
export const RATE_LIMIT_AI: RateLimitConfig = { maxRequests: 30, windowSeconds: 60 }

/** Chat route: 20 messages per minute per user */
export const RATE_LIMIT_CHAT: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 }

/** Heavy AI routes (deep research, etc.): 10 per minute */
export const RATE_LIMIT_HEAVY: RateLimitConfig = { maxRequests: 10, windowSeconds: 60 }

/** Batch extraction (tabular review): 60 per minute to support 100+ doc reviews */
export const RATE_LIMIT_BATCH: RateLimitConfig = { maxRequests: 60, windowSeconds: 60 }

/** File uploads: 20 per minute per user */
export const RATE_LIMIT_UPLOAD: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 }

/** Login/auth attempts: 10 per minute per IP */
export const RATE_LIMIT_AUTH: RateLimitConfig = { maxRequests: 10, windowSeconds: 60 }

/** Global API: 120 requests per minute per user (hard ceiling) */
export const RATE_LIMIT_GLOBAL: RateLimitConfig = { maxRequests: 120, windowSeconds: 60 }
