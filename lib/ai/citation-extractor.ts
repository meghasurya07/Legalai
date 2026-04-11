import OpenAI from 'openai'

/**
 * Helper to emit SSE phase events for the streaming chat response.
 */
export function phaseEvent(phase: string, status: string, detail?: string, meta?: Record<string, unknown>) {
    return `event: phase\ndata: ${JSON.stringify({ phase, status, detail, ...meta })}\n\n`
}

/**
 * Extract url_citation annotations from a completed Responses API response.
 * Returns processedText (with [N] markers replacing OpenAI citation markers)
 * and a <!--SOURCES: block with [N] title | url | snippet.
 */
export function extractCitationsFromResponse(
    response: OpenAI.Responses.Response,
    startNum: number = 1
): { processedText: string; sourcesBlock: string } {
    const urlToNum = new Map<string, number>()
    const citations: { num: number; title: string; url: string; snippet: string }[] = []
    let num = startNum

    interface AnnotationInfo { startIndex: number; endIndex: number; url: string; title: string }
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
                                    title: ann.title || ann.url
                                })
                                if (!urlToNum.has(ann.url)) {
                                    const snippetStart = Math.max(0, ann.start_index - 150)
                                    const contextBefore = outputText.slice(snippetStart, ann.start_index).trim()
                                    const sentenceBreak = contextBefore.search(/[.!?]\s+[A-Z]/)
                                    const snippet = sentenceBreak !== -1
                                        ? contextBefore.slice(sentenceBreak + 2).trim()
                                        : contextBefore

                                    urlToNum.set(ann.url, num)
                                    citations.push({
                                        num,
                                        title: ann.title || ann.url,
                                        url: ann.url,
                                        snippet: snippet.replace(/\n/g, ' ').slice(0, 120)
                                    })
                                    num++
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (citations.length === 0 || !outputText) {
        return { processedText: outputText, sourcesBlock: '' }
    }

    // Replace OpenAI's inline citation text with [N] markers (process from end to preserve indices)
    allAnnotations.sort((a, b) => b.startIndex - a.startIndex)
    let processedText = outputText
    for (const ann of allAnnotations) {
        const citNum = urlToNum.get(ann.url)!
        processedText = processedText.slice(0, ann.startIndex) + ` [${citNum}]` + processedText.slice(ann.endIndex)
    }

    const lines = citations.map(c => `[${c.num}] ${c.title} | ${c.url} | ${c.snippet}`)
    const sourcesBlock = `\n\n<!--SOURCES:\n${lines.join('\n')}\n-->`

    return { processedText, sourcesBlock }
}
