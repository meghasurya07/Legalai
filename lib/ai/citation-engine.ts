/**
 * Citation Engine — Central, structured citation management.
 *
 * Replaces the scattered citation logic that was previously spread across
 * stream-completions.ts, stream-responses.ts, citation-extractor.ts, and
 * retrieve.ts with a single, tested, composable engine.
 *
 * The engine produces a `CitationIndex` — a structured JSON object that
 * travels alongside message content instead of the fragile <!--SOURCES:--> block.
 */

import type OpenAI from 'openai'
import type { RetrievedChunk } from '@/lib/rag/retrieve'
import type { CitationEntry, CitationIndex } from '@/lib/citations'

// ─── Validation ──────────────────────────────────────────────────────

export interface ValidationResult {
    /** Text with orphaned markers removed */
    cleanedText: string
    /** Marker numbers that had no matching source */
    orphanedMarkers: number[]
    /** Marker numbers that were valid */
    validMarkers: number[]
}

// ─── Engine ──────────────────────────────────────────────────────────

export class CitationEngine {
    private entries: CitationEntry[] = []
    private nextNum = 1

    /**
     * Register RAG chunks as potential citation sources.
     * Called once after retrieval, before LLM generation.
     */
    registerRAGSources(chunks: RetrievedChunk[]): void {
        for (const chunk of chunks) {
            let title = chunk.fileName || 'Document'
            if (chunk.pageNumber) title += ` — Page ${chunk.pageNumber}`
            if (chunk.sectionHeading) title += ` — ${chunk.sectionHeading}`

            const url = chunk.fileId.startsWith('upload-')
                ? `https://upload.local/file/${encodeURIComponent(chunk.fileId)}`
                : `https://documents.app/document/${chunk.fileId}?ci=${chunk.chunkIndex}`

            this.entries.push({
                id: `rag-${chunk.id}`,
                num: this.nextNum,
                type: 'rag',
                title,
                url,
                snippet: chunk.content.replace(/\r?\n/g, ' ').substring(0, 800),
                confidence: Math.min(1, chunk.similarity * 1.2), // boost similarity into 0–1 confidence
                metadata: {
                    fileId: chunk.fileId,
                    chunkIndex: chunk.chunkIndex,
                    pageNumber: chunk.pageNumber ?? undefined,
                    sectionHeading: chunk.sectionHeading ?? undefined,
                },
            })
            this.nextNum++
        }
    }

    /**
     * Register web citations from a completed OpenAI Responses API response.
     * Extracts url_citation annotations and creates CitationEntry objects.
     */
    registerWebCitations(response: OpenAI.Responses.Response): void {
        const urlToNum = new Map<string, number>()

        interface AnnotationInfo {
            startIndex: number
            endIndex: number
            url: string
            title: string
        }
        const allAnnotations: AnnotationInfo[] = []
        let outputText = ''

        for (const item of response.output) {
            if (item.type === 'message' && item.content) {
                for (const block of item.content) {
                    if (block.type === 'output_text') {
                        outputText = block.text || ''
                        if (block.annotations) {
                            for (const ann of block.annotations) {
                                if (ann.type === 'url_citation') {
                                    allAnnotations.push({
                                        startIndex: ann.start_index,
                                        endIndex: ann.end_index,
                                        url: ann.url,
                                        title: ann.title || ann.url,
                                    })
                                }
                            }
                        }
                    }
                }
            }
        }

        // Deduplicate by URL and create entries
        for (const ann of allAnnotations) {
            if (urlToNum.has(ann.url)) continue

            // Extract a snippet from the text near the annotation
            const snippetStart = Math.max(0, ann.startIndex - 150)
            const contextBefore = outputText.slice(snippetStart, ann.startIndex).trim()
            const sentenceBreak = contextBefore.search(/[.!?]\s+[A-Z]/)
            const snippet = sentenceBreak !== -1
                ? contextBefore.slice(sentenceBreak + 2).trim()
                : contextBefore

            urlToNum.set(ann.url, this.nextNum)
            this.entries.push({
                id: `web-${hashUrl(ann.url)}`,
                num: this.nextNum,
                type: 'web',
                title: ann.title,
                url: ann.url,
                snippet: snippet.replace(/\n/g, ' ').slice(0, 120),
                confidence: 1, // web search citations are high-confidence
                metadata: {
                    startIndex: ann.startIndex,
                    endIndex: ann.endIndex,
                },
            })
            this.nextNum++
        }

        // Store for use in processResponseText
        this._webAnnotations = allAnnotations
        this._webUrlToNum = urlToNum
        this._webOutputText = outputText
    }

    private _webAnnotations: Array<{ startIndex: number; endIndex: number; url: string; title: string }> = []
    private _webUrlToNum = new Map<string, number>()
    private _webOutputText = ''

    /**
     * Process the raw Responses API output text, replacing OpenAI's inline
     * citation markers (e.g. 【4:2†source】) with [N] markers.
     *
     * Returns the clean text with [N] markers only.
     */
    processResponseText(rawText: string): string {
        if (this._webAnnotations.length === 0) return rawText

        // Use the original output text from the response (before streaming cleanup)
        const sourceText = this._webOutputText || rawText

        // Sort annotations from end to start to preserve indices
        const sorted = [...this._webAnnotations].sort((a, b) => b.startIndex - a.startIndex)

        let processed = sourceText
        for (const ann of sorted) {
            const citNum = this._webUrlToNum.get(ann.url)
            if (citNum === undefined) continue
            processed = processed.slice(0, ann.startIndex) + ` [${citNum}]` + processed.slice(ann.endIndex)
        }

        // Clean any remaining OpenAI markers that weren't caught
        processed = processed.replace(/【[^】]*】/g, '')

        return processed
    }

    /**
     * Validate that [N] markers in the AI response text correspond to
     * registered citation sources. Removes orphaned markers.
     */
    validateMarkers(text: string): ValidationResult {
        const markerRegex = /\[(\d+)\]/g
        const validNums = new Set(this.entries.map(e => e.num))
        const orphanedMarkers: number[] = []
        const validMarkers: number[] = []

        // Collect all marker numbers
        const matches = Array.from(text.matchAll(markerRegex))
        for (const m of matches) {
            const num = parseInt(m[1], 10)
            if (validNums.has(num)) {
                validMarkers.push(num)
            } else {
                orphanedMarkers.push(num)
            }
        }

        // Remove orphaned markers from text
        let cleanedText = text
        if (orphanedMarkers.length > 0) {
            const orphanSet = new Set(orphanedMarkers)
            cleanedText = text.replace(/\[(\d+)\]/g, (match, numStr) => {
                return orphanSet.has(parseInt(numStr, 10)) ? '' : match
            })
            // Clean up double spaces left by removed markers
            cleanedText = cleanedText.replace(/  +/g, ' ').trim()
        }

        return { cleanedText, orphanedMarkers, validMarkers }
    }

    /**
     * Improve snippet selection for a RAG citation using TF-IDF-weighted
     * word overlap between the AI response context and the chunk content.
     *
     * This replaces the simple word-overlap heuristic in buildDynamicRAGSourcesBlock.
     */
    findBestSnippet(chunk: RetrievedChunk, responseText: string, markerNum: number): string {
        const citMarker = `[${markerNum}]`
        const markerIdx = responseText.indexOf(citMarker)

        // Get context near the citation marker
        let contextText = responseText
        if (markerIdx !== -1) {
            const startIdx = Math.max(0, markerIdx - 500)
            contextText = responseText.substring(startIdx, markerIdx)
        }

        // Build word frequency map (TF-IDF-like weighting)
        const contextWords = extractSignificantWords(contextText)
        const contextFreq = new Map<string, number>()
        for (const w of contextWords) {
            contextFreq.set(w, (contextFreq.get(w) || 0) + 1)
        }

        // Split chunk into sentences
        const sentences = chunk.content.match(/[^.!?]+(?:[.!?]+|$)/g) || [chunk.content]

        let maxScore = -1
        let bestSentenceIdx = 0

        for (let s = 0; s < sentences.length; s++) {
            const sentenceText = sentences[s].trim()
            if (sentenceText.length < 10) continue

            const sentWords = extractSignificantWords(sentenceText)
            let score = 0

            for (const w of sentWords) {
                const freq = contextFreq.get(w)
                if (freq) {
                    // Weight: common context words score less, rare matches score more
                    // Words that appear once in context are more discriminating
                    const weight = 1 / Math.sqrt(freq)
                    score += weight
                }
            }

            // Bonus for legal-specific exact matches (case names, statute numbers, regulations)
            const legalTerms = sentenceText.match(
                /\b(?:§\s*\d+(?:\.\d+)*|\d+\s+U\.S\.C\.?\s*§?\s*\d+|\d+\s+C\.F\.R\.?\s*§?\s*\d+|v\.\s+\w+|\d{4}\s+WL\s+\d+|\d{4}\s+LEXIS\s+\d+|\d+\s+(?:F\.(?:2d|3d|4th|Supp)|S\.\s*Ct|L\.\s*Ed)|Art(?:icle)?\s+\d+|Clause\s+\d+|Section\s+\d+(?:\.\d+)*|Regulation\s+\(?[A-Z]|\d+\.\d+\([a-z]\))/gi
            )
            if (legalTerms) {
                for (const term of legalTerms) {
                    if (contextText.toLowerCase().includes(term.toLowerCase())) {
                        score += 3 // Heavy bonus for exact legal reference matches
                    }
                }
            }

            if (score > maxScore) {
                maxScore = score
                bestSentenceIdx = s
            }
        }

        // Gather context: 2-3 best sentences for sentence-level granularity
        let gatheredSnippet = ''
        let currentS = Math.max(0, bestSentenceIdx - 1)

        while (gatheredSnippet.length < 400 && currentS < sentences.length) {
            gatheredSnippet += sentences[currentS].trim() + ' '
            currentS++
        }

        return gatheredSnippet.trim().substring(0, 400).replace(/\r?\n/g, ' ')
    }

    /**
     * Build the final `CitationIndex` from registered sources,
     * improving snippets based on the AI response text.
     */
    buildIndex(responseText: string): CitationIndex {
        // Find which citations were actually used in the response
        const usedNums = new Set<number>()
        const markerRegex = /\[(\d+)\]/g
        for (const m of Array.from(responseText.matchAll(markerRegex))) {
            usedNums.add(parseInt(m[1], 10))
        }

        // Improve snippets for RAG entries using the response context
        for (const entry of this.entries) {
            if (entry.type === 'rag' && usedNums.has(entry.num) && entry.metadata.fileId) {
                // We can't access the original chunk here directly, so snippet
                // improvement happens in the calling code before buildIndex
            }
        }

        // Build marker map
        const markerMap: Record<string, number> = {}
        this.entries.forEach((e, i) => {
            markerMap[String(e.num)] = i
        })

        return { entries: this.entries, markerMap }
    }

    /**
     * Serialize the citation index as a <!--CITATION_INDEX:{...}--> block
     * for inclusion in the stored message content.
     */
    serialize(): string {
        if (this.entries.length === 0) return ''

        const markerMap: Record<string, number> = {}
        this.entries.forEach((e, i) => {
            markerMap[String(e.num)] = i
        })

        const index: CitationIndex = { entries: this.entries, markerMap }
        return `\n\n<!--CITATION_INDEX:${JSON.stringify(index)}-->`
    }

    /**
     * Get all registered entries.
     */
    getEntries(): CitationEntry[] {
        return this.entries
    }

    /**
     * Check if any citations are registered.
     */
    hasCitations(): boolean {
        return this.entries.length > 0
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Extract significant words (length > 3, lowercased) from text. */
function extractSignificantWords(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
}

/** Simple URL hash for stable IDs. */
function hashUrl(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0 // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
}
