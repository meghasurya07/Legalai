import { launchResearchSession, closeSession, isSolariConfigured, type SolariSession } from './client'
import { searchGoogleScholar, searchCornellLII, searchJustia, type LegalSource } from './legal-scraper'

// ─── Types ───────────────────────────────────────────────────────

export interface WebResearchResult {
  query: string
  sources: LegalSource[]
  sessionId: string
  durationMs: number
  searchedSources: string[]
}

export type ResearchSource = 'google_scholar' | 'cornell_lii' | 'justia'

const ALL_SOURCES: ResearchSource[] = ['google_scholar', 'cornell_lii', 'justia']

// ─── Main Research Function ──────────────────────────────────────

/**
 * Run a multi-source legal web research session using Solari cloud browser.
 * Searches across Google Scholar, Cornell LII, and Justia in parallel.
 */
export async function runLegalResearch(
  query: string,
  options: {
    sources?: ResearchSource[]
    maxResultsPerSource?: number
  } = {}
): Promise<WebResearchResult> {
  if (!isSolariConfigured()) {
    throw new Error('Solari is not configured. Set SOLARI_API_KEY in your environment.')
  }

  const start = Date.now()
  const sources = options.sources || ALL_SOURCES
  const maxPerSource = options.maxResultsPerSource || 5
  
  let session: SolariSession | null = null
  
  try {
    session = await launchResearchSession()
    
    // Run searches in parallel across selected sources
    const searchPromises: Promise<LegalSource[]>[] = []
    const searchedSources: string[] = []
    
    if (sources.includes('google_scholar')) {
      searchPromises.push(searchGoogleScholar(session.browser, query, maxPerSource))
      searchedSources.push('Google Scholar')
    }
    if (sources.includes('cornell_lii')) {
      searchPromises.push(searchCornellLII(session.browser, query, maxPerSource))
      searchedSources.push('Cornell LII')
    }
    if (sources.includes('justia')) {
      searchPromises.push(searchJustia(session.browser, query, maxPerSource))
      searchedSources.push('Justia')
    }
    
    const results = await Promise.allSettled(searchPromises)
    
    // Collect all successful results
    const allSources: LegalSource[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allSources.push(...result.value)
      }
    }
    
    // Deduplicate by URL
    const seen = new Set<string>()
    const deduplicated = allSources.filter(s => {
      if (seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })
    
    return {
      query,
      sources: deduplicated,
      sessionId: session.sessionId,
      durationMs: Date.now() - start,
      searchedSources,
    }
  } finally {
    if (session) {
      await closeSession(session)
    }
  }
}

/**
 * Format research results into a context string for the AI prompt.
 */
export function formatResearchContext(result: WebResearchResult): string {
  if (result.sources.length === 0) {
    return 'No relevant legal sources found from web research.'
  }
  
  const lines: string[] = [
    `## Web Research Results (${result.sources.length} sources found)`,
    `Searched: ${result.searchedSources.join(', ')}`,
    '',
  ]
  
  result.sources.forEach((source, i) => {
    lines.push(`### Source ${i + 1}: ${source.title}`)
    if (source.citation) lines.push(`Citation: ${source.citation}`)
    if (source.date) lines.push(`Year: ${source.date}`)
    lines.push(`URL: ${source.url}`)
    lines.push(`Source: ${source.source.replace('_', ' ')}`)
    if (source.snippet) lines.push(`Summary: ${source.snippet}`)
    lines.push('')
  })
  
  return lines.join('\n')
}
