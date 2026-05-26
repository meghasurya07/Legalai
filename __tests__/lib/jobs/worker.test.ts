import { describe, it, expect } from 'vitest'

/**
 * Re-implementation of the private calculateBackoffDelay function from
 * @/lib/jobs/worker.ts (lines 73-79) so we can unit-test the algorithm directly.
 */
function calculateBackoffDelay(attempt: number): number {
    const baseDelay = 30_000
    const maxDelay = 15 * 60_000
    const delay = baseDelay * Math.pow(2, attempt - 1)
    const jitter = delay * (0.8 + Math.random() * 0.4)
    return Math.min(jitter, maxDelay)
}

describe('calculateBackoffDelay (algorithm mirror)', () => {
    // ── Attempt 1 ────────────────────────────────────────────
    it('attempt 1: base delay is 30000 with jitter range 24000-42000', () => {
        // base = 30000 * 2^0 = 30000; jitter range = 30000*0.8 .. 30000*1.2
        for (let i = 0; i < 50; i++) {
            const result = calculateBackoffDelay(1)
            expect(result).toBeGreaterThanOrEqual(24_000)
            expect(result).toBeLessThanOrEqual(42_000)
        }
    })

    // ── Attempt 2 ────────────────────────────────────────────
    it('attempt 2: base delay 60000 with jitter range 48000-84000', () => {
        for (let i = 0; i < 50; i++) {
            const result = calculateBackoffDelay(2)
            expect(result).toBeGreaterThanOrEqual(48_000)
            expect(result).toBeLessThanOrEqual(84_000)
        }
    })

    // ── Attempt 3 ────────────────────────────────────────────
    it('attempt 3: base delay 120000 with jitter range 96000-168000', () => {
        for (let i = 0; i < 50; i++) {
            const result = calculateBackoffDelay(3)
            expect(result).toBeGreaterThanOrEqual(96_000)
            expect(result).toBeLessThanOrEqual(168_000)
        }
    })

    // ── Attempt 4 ────────────────────────────────────────────
    it('attempt 4: base delay is 240000 (30000 * 2^3)', () => {
        // With Math.random() = 0 → jitter factor = 0.8 → 192000
        // With Math.random() = 1 → jitter factor = 1.2 → 288000
        for (let i = 0; i < 50; i++) {
            const result = calculateBackoffDelay(4)
            expect(result).toBeGreaterThanOrEqual(240_000 * 0.8)
            expect(result).toBeLessThanOrEqual(240_000 * 1.2)
        }
    })

    // ── High attempt (10): capped at maxDelay 900000 ─────────
    it('high attempts (attempt 10): result is capped at 900000 (15 minutes)', () => {
        // base = 30000 * 2^9 = 15_360_000, far exceeds cap of 900_000
        for (let i = 0; i < 50; i++) {
            const result = calculateBackoffDelay(10)
            expect(result).toBeLessThanOrEqual(900_000)
        }
    })

    // ── Jitter stays within ±20% of computed delay ───────────
    it('jitter stays within ±20% of the computed delay', () => {
        for (let attempt = 1; attempt <= 6; attempt++) {
            const rawDelay = 30_000 * Math.pow(2, attempt - 1)
            const maxDelay = 900_000
            for (let i = 0; i < 20; i++) {
                const result = calculateBackoffDelay(attempt)
                // Result should be min(jitter, maxDelay) where jitter ∈ [0.8*raw, 1.2*raw]
                expect(result).toBeLessThanOrEqual(Math.min(rawDelay * 1.2, maxDelay))
                expect(result).toBeGreaterThanOrEqual(Math.min(rawDelay * 0.8, maxDelay))
            }
        }
    })

    // ── Always positive ──────────────────────────────────────
    it('delay is always positive for any attempt value', () => {
        const attempts = [1, 2, 3, 5, 8, 10, 20]
        for (const attempt of attempts) {
            const result = calculateBackoffDelay(attempt)
            expect(result).toBeGreaterThan(0)
        }
    })

    // ── Randomness / jitter produces different values ────────
    it('multiple calls produce different values due to jitter randomness', () => {
        const results = new Set<number>()
        for (let i = 0; i < 20; i++) {
            results.add(calculateBackoffDelay(1))
        }
        // With 20 random calls, we should get more than 1 unique value
        expect(results.size).toBeGreaterThan(1)
    })
})
