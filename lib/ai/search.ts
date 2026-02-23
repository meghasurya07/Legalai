// Tavily Web Search Service
// Provides real web search capabilities for the AI chat

export interface SearchResult {
    title: string
    url: string
    content: string  // extracted text snippet
    score: number
}

export interface SearchResponse {
    results: SearchResult[]
    query: string
}

/**
 * Search the web using Tavily API
 */
export async function searchWeb(query: string, maxResults = 5, searchDepth: 'basic' | 'advanced' = 'basic'): Promise<SearchResponse> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
        console.warn('TAVILY_API_KEY not set — web search unavailable')
        return { results: [], query }
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                max_results: maxResults,
                include_answer: false,
                include_raw_content: false,
                search_depth: searchDepth
            })
        })

        if (!response.ok) {
            console.error('Tavily search failed:', response.status)
            return { results: [], query }
        }

        const data = await response.json()
        return {
            query,
            results: (data.results || []).map((r: { title: string; url: string; content: string; score: number }) => ({
                title: r.title || '',
                url: r.url || '',
                content: r.content || '',
                score: r.score || 0
            }))
        }
    } catch (error) {
        console.error('Tavily search error:', error)
        return { results: [], query }
    }
}

/**
 * Search multiple queries in parallel (for deep research)
 */
export async function searchMultiple(queries: string[], maxResultsPerQuery = 5, searchDepth: 'basic' | 'advanced' = 'basic'): Promise<SearchResponse[]> {
    const results = await Promise.all(
        queries.map(q => searchWeb(q, maxResultsPerQuery, searchDepth))
    )
    return results
}

/**
 * Format search results into context text for the AI prompt
 */
export function formatSearchResultsAsContext(responses: SearchResponse[]): string {
    const sections: string[] = []

    for (const resp of responses) {
        if (resp.results.length === 0) continue

        sections.push(`--- Search: "${resp.query}" ---`)
        for (const r of resp.results) {
            sections.push(`[${r.title}](${r.url})`)
            sections.push(r.content)
            sections.push('')
        }
    }

    return sections.join('\n')
}

/**
 * Build a sources block from search results for the AI response
 */
export function buildSourcesBlock(responses: SearchResponse[]): string {
    const seen = new Set<string>()
    const sources: { num: number; title: string; url: string; content: string }[] = []
    let num = 1

    for (const resp of responses) {
        for (const r of resp.results) {
            if (seen.has(r.url)) continue
            seen.add(r.url)
            sources.push({ num, title: r.title, url: r.url, content: r.content })
            num++
        }
    }

    if (sources.length === 0) return ''

    const lines = sources.map(s => `[${s.num}] ${s.title} | ${s.url} | ${s.content.replace(/\r?\n/g, ' ').substring(0, 200)}`)
    return `\n\n<!--SOURCES:\n${lines.join('\n')}\n-->`
}
