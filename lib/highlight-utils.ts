/**
 * Shared text highlight matching utilities.
 *
 * Used by the document viewer, DocTextViewer (pdf-citation-panel), and
 * PDF viewer to find and highlight cited passages in source documents.
 *
 * The core algorithm normalises whitespace (tabs, newlines, multiple spaces
 * → single space) and performs case-insensitive matching with progressive
 * degradation: full snippet → 200 chars → 100 → 60 → 30.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface NormalizedText {
    /** Normalised (single-spaced, lowercase) version of the input */
    normalized: string
    /** Maps each index in `normalized` back to the corresponding index in the original text */
    indexMap: number[]
}

export interface HighlightRange {
    /** Start index in the original (un-normalised) text */
    start: number
    /** End index (exclusive) in the original text */
    end: number
}

// ─── Normalisation ────────────────────────────────────────────────

/**
 * Build a normalised version of `text` where runs of whitespace are
 * collapsed to a single space and all characters are lowercased.
 *
 * Also returns an index map so we can translate a match position in the
 * normalised string back to the original string.
 */
export function normalizeTextForSearch(text: string): NormalizedText {
    let normalized = ''
    let isSpace = false
    const indexMap: number[] = []

    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (/\s/.test(char)) {
            if (!isSpace && normalized.length > 0) {
                normalized += ' '
                indexMap.push(i)
                isSpace = true
            }
        } else {
            normalized += char.toLowerCase()
            indexMap.push(i)
            isSpace = false
        }
    }
    // Sentinel so indexMap[matchEnd] always resolves
    indexMap.push(text.length)

    return { normalized, indexMap }
}

// ─── Main matching function ───────────────────────────────────────

/**
 * Find the position of `snippet` inside `fullText` using whitespace-
 * normalised, case-insensitive matching with progressive degradation.
 *
 * Returns the range in the **original** (un-normalised) `fullText`, or
 * `null` if no match can be found at any degradation level.
 *
 * Degradation steps:
 *   1. Try the full normalised snippet
 *   2. First 200 chars
 *   3. First 100 chars
 *   4. First 60 chars
 *   5. First 30 chars
 */
export function findHighlightRange(
    fullText: string,
    snippet: string,
    minLength: number = 15,
): HighlightRange | null {
    if (!fullText || !snippet || snippet.length < minLength) return null

    const { normalized: normalizedPage, indexMap } = normalizeTextForSearch(fullText)
    const normalizedSnippet = snippet.replace(/\s+/g, ' ').trim().toLowerCase()

    if (normalizedSnippet.length < minLength) return null

    // Progressive degradation: try increasingly shorter prefixes
    const searchLengths = [
        normalizedSnippet.length,              // full
        Math.min(normalizedSnippet.length, 200),
        Math.min(normalizedSnippet.length, 100),
        Math.min(normalizedSnippet.length, 60),
        Math.min(normalizedSnippet.length, 30),
    ]
    // Deduplicate (e.g. if snippet is < 200 chars, avoid searching twice)
    const uniqueLengths = [...new Set(searchLengths)]

    for (const len of uniqueLengths) {
        if (len < minLength) continue
        const searchStr = normalizedSnippet.substring(0, len)
        const matchIndex = normalizedPage.indexOf(searchStr)
        if (matchIndex !== -1) {
            // Extend match to full snippet length when possible
            const matchLength = Math.min(
                normalizedSnippet.length,
                normalizedPage.length - matchIndex,
            )
            const originalStart = indexMap[matchIndex]
            const originalEnd = indexMap[Math.min(matchIndex + matchLength, indexMap.length - 1)]
            return { start: originalStart, end: originalEnd }
        }
    }

    return null
}
