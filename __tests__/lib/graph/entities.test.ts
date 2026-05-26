import { describe, it, expect } from 'vitest'
import { normalizeName } from '@/lib/graph/entities'

// ---------------------------------------------------------------------------
// Re-implement private levenshtein function (entities.ts lines 115-134)
// to test the algorithm independently.
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
    const m = a.length
    const n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
        }
    }
    return dp[m][n]
}

// ---------------------------------------------------------------------------
// Re-implement the similarity logic (entities.ts lines 190-198)
// ---------------------------------------------------------------------------
function isSimilar(nameA: string, nameB: string): boolean {
    const distance = levenshtein(nameA, nameB)
    const maxLen = Math.max(nameA.length, nameB.length)
    return maxLen > 0 && (
        (nameA === nameB) ||
        (distance <= 2 && maxLen >= 4) ||
        (maxLen >= 6 && distance / maxLen <= 0.25)
    )
}

// ---------------------------------------------------------------------------
// Re-implement normalizeForDedup (clauses.ts lines 93-100)
// ---------------------------------------------------------------------------
function normalizeForDedup(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\s]+/g, ' ')
        .replace(/["\u201c\u201d\u2018\u2019]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .trim()
}

// ===================================================================
// TESTS
// ===================================================================

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------
describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
        expect(levenshtein('kitten', 'kitten')).toBe(0)
    })

    it('returns 0 for two empty strings', () => {
        expect(levenshtein('', '')).toBe(0)
    })

    it('returns length of the other string when one is empty', () => {
        expect(levenshtein('', 'abc')).toBe(3)
        expect(levenshtein('hello', '')).toBe(5)
    })

    it('returns 1 for a single character substitution', () => {
        // "acme" -> "acne" (m -> n)
        expect(levenshtein('acme', 'acne')).toBe(1)
    })

    it('returns 1 for a single insertion', () => {
        // "cat" -> "cats"
        expect(levenshtein('cat', 'cats')).toBe(1)
    })

    it('returns 1 for a single deletion', () => {
        // "cats" -> "cat"
        expect(levenshtein('cats', 'cat')).toBe(1)
    })

    it('returns max length for completely different strings', () => {
        expect(levenshtein('abc', 'xyz')).toBe(3)
    })

    it('handles classic kitten/sitting example (distance 3)', () => {
        expect(levenshtein('kitten', 'sitting')).toBe(3)
    })

    it('is symmetric', () => {
        expect(levenshtein('foo', 'bar')).toBe(levenshtein('bar', 'foo'))
    })
})

// ---------------------------------------------------------------------------
// normalizeName (exported from entities.ts)
// ---------------------------------------------------------------------------
describe('normalizeName', () => {
    it('lowercases the input', () => {
        expect(normalizeName('ACME Corp')).toBe('acme corp')
    })

    it('trims leading and trailing whitespace', () => {
        expect(normalizeName('  hello world  ')).toBe('hello world')
    })

    it('collapses multiple internal spaces to a single space', () => {
        expect(normalizeName('John    Doe')).toBe('john doe')
    })

    it('strips non-word non-space characters (punctuation)', () => {
        expect(normalizeName('Acme, Inc.')).toBe('acme inc')
    })

    it('handles tabs and mixed whitespace', () => {
        expect(normalizeName('  foo\t\tbar  ')).toBe('foo bar')
    })

    it('returns empty string for empty input', () => {
        expect(normalizeName('')).toBe('')
    })

    it('preserves underscores (\\w matches them)', () => {
        expect(normalizeName('hello_world')).toBe('hello_world')
    })
})

// ---------------------------------------------------------------------------
// Entity similarity logic
// ---------------------------------------------------------------------------
describe('entity similarity (isSimilar)', () => {
    it('considers identical normalized names as similar', () => {
        expect(isSimilar('acme corp', 'acme corp')).toBe(true)
    })

    it('considers single-char typo in 4+ char name as similar (distance<=2, maxLen>=4)', () => {
        // "acme" vs "acne" -> distance 1, maxLen 4
        expect(isSimilar('acme', 'acne')).toBe(true)
    })

    it('considers two-char typo in long name as similar (distance<=2, maxLen>=4)', () => {
        // "greenfield" vs "greanfield" -> distance 1
        expect(isSimilar('greenfield', 'greanfield')).toBe(true)
    })

    it('considers distance/maxLen <= 0.25 for names >= 6 chars as similar', () => {
        // "johnson" (7) vs "johnsan" (7) -> distance 1, ratio 1/7 ≈ 0.14
        expect(isSimilar('johnson', 'johnsan')).toBe(true)
    })

    it('rejects very short strings with distance > 0 (maxLen < 4)', () => {
        // "ab" vs "cd" -> distance 2, maxLen 2 (fails maxLen>=4), also maxLen<6
        expect(isSimilar('ab', 'cd')).toBe(false)
    })

    it('rejects when distance > 2 AND ratio > 0.25', () => {
        // "abcde" vs "xyzwe" -> distance 4, maxLen 5, ratio 0.8
        expect(isSimilar('abcde', 'xyzwe')).toBe(false)
    })

    it('rejects two empty strings (maxLen === 0)', () => {
        expect(isSimilar('', '')).toBe(false)
    })

    it('considers "corporation" vs "corporatoin" similar (distance 2, ratio 2/11 ≈ 0.18)', () => {
        expect(isSimilar('corporation', 'corporatoin')).toBe(true)
    })

    it('rejects "alpha" vs "omega" (distance 4, maxLen 5, ratio 0.8)', () => {
        expect(isSimilar('alpha', 'omega')).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// normalizeForDedup (from clauses.ts)
// ---------------------------------------------------------------------------
describe('normalizeForDedup', () => {
    it('lowercases text', () => {
        expect(normalizeForDedup('HELLO WORLD')).toBe('hello world')
    })

    it('collapses multiple whitespace characters to single spaces', () => {
        expect(normalizeForDedup('foo   bar\t\nbaz')).toBe('foo bar baz')
    })

    it('trims leading and trailing whitespace', () => {
        expect(normalizeForDedup('   text   ')).toBe('text')
    })

    it('normalizes smart double quotes (\u201c \u201d) to straight quotes', () => {
        expect(normalizeForDedup('\u201cHello\u201d')).toBe('"hello"')
    })

    it('normalizes smart single quotes (\u2018 \u2019) to straight quotes', () => {
        expect(normalizeForDedup('\u2018world\u2019')).toBe('"world"')
    })

    it('normalizes en-dash (\u2013) to hyphen', () => {
        expect(normalizeForDedup('2020\u20132025')).toBe('2020-2025')
    })

    it('normalizes em-dash (\u2014) to hyphen', () => {
        expect(normalizeForDedup('clause\u2014section')).toBe('clause-section')
    })

    it('applies all normalizations together', () => {
        const input = '  \u201cParty A\u201d shall pay \u2014 within 30\u2013days  '
        expect(normalizeForDedup(input)).toBe('"party a" shall pay - within 30-days')
    })

    it('returns empty string for whitespace-only input', () => {
        expect(normalizeForDedup('   ')).toBe('')
    })
})
