/**
 * RAG Text Chunker
 * 
 * Splits extracted text into semantic chunks suitable for embedding.
 * Preserves sentence boundaries with configurable overlap.
 */

import { RAG_CONFIG } from '@/lib/ai/config'

export interface Chunk {
    content: string
    tokenCount: number
    chunkIndex: number
    pageNumber?: number
    sectionHeading?: string
}

interface ChunkOptions {
    minTokens?: number
    maxTokens?: number
    overlapPercent?: number
}

const DEFAULTS: Required<ChunkOptions> = {
    minTokens: RAG_CONFIG.chunking.minTokens,
    maxTokens: RAG_CONFIG.chunking.maxTokens,
    overlapPercent: RAG_CONFIG.chunking.overlapPercent,
}

// Approximate token count (~4 chars per token for English, OpenAI compatible)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

// Detect section headings from text patterns
function detectSectionHeading(text: string): string | undefined {
    // Match common heading patterns: ALL CAPS lines, numbered sections, markdown headers
    const lines = text.split('\n').slice(0, 3)
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        // ALL CAPS heading (min 3 chars, max 100)
        if (trimmed.length >= 3 && trimmed.length <= 100 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
            return trimmed
        }
        // Numbered section: "1. Title" or "Section 1:"
        const numberedMatch = trimmed.match(/^(?:section\s+)?\d+[\.\)]\s*(.+)/i)
        if (numberedMatch && numberedMatch[1].length <= 80) {
            return numberedMatch[1].trim()
        }
        // Markdown header
        const mdMatch = trimmed.match(/^#{1,4}\s+(.+)/)
        if (mdMatch) {
            return mdMatch[1].trim()
        }
    }
    return undefined
}

// Detect approximate page number from page break markers
function detectPageNumber(text: string, globalOffset: number, fullText: string): number | undefined {
    // Count page breaks (form feed characters or common page markers) before this position
    const textBefore = fullText.slice(0, globalOffset)
    const pageBreaks = (textBefore.match(/\f/g) || []).length
    if (pageBreaks > 0) return pageBreaks + 1

    // Check for "Page X" patterns
    const pagePattern = /page\s+(\d+)/gi
    let lastPage: number | undefined
    let match: RegExpExecArray | null
    const searchText = textBefore.slice(-2000) // Search last 2000 chars
    while ((match = pagePattern.exec(searchText)) !== null) {
        lastPage = parseInt(match[1], 10)
    }
    return lastPage
}

// Split text into sentences, preserving boundaries
function splitSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by whitespace or newline
    const sentences: string[] = []
    const pattern = /[^.!?\n]+(?:[.!?]+|\n|$)/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
        const s = match[0].trim()
        if (s) sentences.push(s)
    }
    // If no sentences found, split by newlines
    if (sentences.length === 0) {
        return text.split(/\n+/).filter(s => s.trim().length > 0)
    }
    return sentences
}

/**
 * Chunk text into semantic segments for embedding.
 * 
 * @param text - The full extracted text from a document
 * @param options - Chunking configuration
 * @returns Array of chunks with metadata
 */
export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
    const opts = { ...DEFAULTS, ...options }
    const { minTokens, maxTokens, overlapPercent } = opts

    if (!text || text.trim().length === 0) return []

    // Clean the text
    const cleanText = text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    const totalTokens = estimateTokens(cleanText)

    // If the entire text fits in one chunk, return it directly
    if (totalTokens <= maxTokens) {
        if (totalTokens < minTokens) return [] // Too small
        return [{
            content: cleanText,
            tokenCount: totalTokens,
            chunkIndex: 0,
            sectionHeading: detectSectionHeading(cleanText),
            pageNumber: detectPageNumber(cleanText, 0, cleanText)
        }]
    }

    const sentences = splitSentences(cleanText)
    const chunks: Chunk[] = []
    const overlapTokens = Math.floor(maxTokens * overlapPercent)

    let currentChunk: string[] = []
    let currentTokens = 0
    let chunkIndex = 0
    let globalCharOffset = 0
    let chunkStartOffset = 0

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        const sentenceTokens = estimateTokens(sentence)

        // If a single sentence exceeds max, split it by words
        if (sentenceTokens > maxTokens) {
            // Flush current chunk first
            if (currentChunk.length > 0 && currentTokens >= minTokens) {
                const content = currentChunk.join(' ')
                chunks.push({
                    content,
                    tokenCount: currentTokens,
                    chunkIndex,
                    sectionHeading: detectSectionHeading(content),
                    pageNumber: detectPageNumber(content, chunkStartOffset, cleanText)
                })
                chunkIndex++
                // Keep overlap
                const overlapSentences = getOverlapSentences(currentChunk, overlapTokens)
                currentChunk = overlapSentences
                currentTokens = estimateTokens(overlapSentences.join(' '))
                chunkStartOffset = globalCharOffset - overlapSentences.join(' ').length
            }

            // Split long sentence by words
            const words = sentence.split(/\s+/)
            let wordChunk: string[] = []
            let wordTokens = 0
            for (const word of words) {
                const wt = estimateTokens(word + ' ')
                if (wordTokens + wt > maxTokens && wordChunk.length > 0) {
                    const content = [...currentChunk, wordChunk.join(' ')].join(' ')
                    chunks.push({
                        content,
                        tokenCount: estimateTokens(content),
                        chunkIndex,
                        sectionHeading: detectSectionHeading(content),
                        pageNumber: detectPageNumber(content, chunkStartOffset, cleanText)
                    })
                    chunkIndex++
                    currentChunk = []
                    currentTokens = 0
                    chunkStartOffset = globalCharOffset
                    wordChunk = [word]
                    wordTokens = wt
                } else {
                    wordChunk.push(word)
                    wordTokens += wt
                }
            }
            if (wordChunk.length > 0) {
                currentChunk = [wordChunk.join(' ')]
                currentTokens = wordTokens
            }
            globalCharOffset += sentence.length + 1
            continue
        }

        // Normal case: add sentence to current chunk
        if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
            // Flush chunk
            if (currentTokens >= minTokens) {
                const content = currentChunk.join(' ')
                chunks.push({
                    content,
                    tokenCount: currentTokens,
                    chunkIndex,
                    sectionHeading: detectSectionHeading(content),
                    pageNumber: detectPageNumber(content, chunkStartOffset, cleanText)
                })
                chunkIndex++
            }

            // Keep overlap sentences
            const overlapSentences = getOverlapSentences(currentChunk, overlapTokens)
            currentChunk = overlapSentences
            currentTokens = estimateTokens(overlapSentences.join(' '))
            chunkStartOffset = globalCharOffset - overlapSentences.join(' ').length
        }

        currentChunk.push(sentence)
        currentTokens += sentenceTokens
        globalCharOffset += sentence.length + 1
    }

    // Flush remaining
    if (currentChunk.length > 0 && currentTokens >= minTokens) {
        const content = currentChunk.join(' ')
        chunks.push({
            content,
            tokenCount: currentTokens,
            chunkIndex,
            sectionHeading: detectSectionHeading(content),
            pageNumber: detectPageNumber(content, chunkStartOffset, cleanText)
        })
    } else if (currentChunk.length > 0 && chunks.length > 0) {
        // Merge tiny remainder into last chunk
        const lastChunk = chunks[chunks.length - 1]
        const merged = lastChunk.content + ' ' + currentChunk.join(' ')
        lastChunk.content = merged
        lastChunk.tokenCount = estimateTokens(merged)
    }

    return chunks
}

// Get trailing sentences that fit within the overlap token budget
function getOverlapSentences(sentences: string[], overlapTokens: number): string[] {
    const result: string[] = []
    let tokens = 0
    for (let i = sentences.length - 1; i >= 0; i--) {
        const st = estimateTokens(sentences[i])
        if (tokens + st > overlapTokens) break
        result.unshift(sentences[i])
        tokens += st
    }
    return result
}
