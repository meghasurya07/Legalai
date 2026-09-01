import { type SolariSession } from './client'

// ─── Types ───────────────────────────────────────────────────────

export interface LegalSource {
  title: string
  citation: string
  snippet: string
  url: string
  source: 'google_scholar' | 'cornell_lii' | 'justia' | 'web'
  date?: string
  relevanceScore?: number
}

// ─── Google Scholar Case Law ─────────────────────────────────────

export async function searchGoogleScholar(
  browser: SolariSession['browser'],
  query: string,
  maxResults = 5
): Promise<LegalSource[]> {
  const page = await browser.newPage()
  const results: LegalSource[] = []
  
  try {
    const encodedQuery = encodeURIComponent(query)
    await page.goto(
      `https://scholar.google.com/scholar?hl=en&as_sdt=6,34&q=${encodedQuery}`,
      { waitUntil: 'domcontentloaded', timeout: 12000 }
    )
    
    // Wait for results to load
    await page.waitForSelector('.gs_r', { timeout: 6000 }).catch(() => {})
    
    // Extract search results
    const items = await page.$$eval('.gs_r.gs_or', (elements: Element[]) => {
      return elements.slice(0, 10).map(el => {
        const titleEl = el.querySelector('.gs_rt a') || el.querySelector('.gs_rt')
        const snippetEl = el.querySelector('.gs_rs')
        const metaEl = el.querySelector('.gs_a')
        return {
          title: titleEl?.textContent?.trim().replace(/^\[[A-Z]+\]\s*/, '') || '',
          url: (titleEl as HTMLAnchorElement)?.href || '',
          snippet: snippetEl?.textContent?.trim() || '',
          meta: metaEl?.textContent?.trim() || '',
        }
      })
    }).catch(() => [] as { title: string; url: string; snippet: string; meta: string }[])
    
    for (const item of items.slice(0, maxResults)) {
      if (item.title) {
        results.push({
          title: item.title,
          citation: item.meta || item.title,
          snippet: item.snippet.slice(0, 500),
          url: item.url || `https://scholar.google.com/scholar?q=${encodedQuery}`,
          source: 'google_scholar',
          date: extractYear(item.meta),
        })
      }
    }
  } catch (err) {
    console.error('[solari] Google Scholar search failed:', err)
  } finally {
    await page.close()
  }
  
  return results
}

// ─── Cornell LII ─────────────────────────────────────────────────

export async function searchCornellLII(
  browser: SolariSession['browser'],
  query: string,
  maxResults = 5
): Promise<LegalSource[]> {
  const page = await browser.newPage()
  const results: LegalSource[] = []
  
  try {
    const term = query.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    await page.goto(
      `https://www.law.cornell.edu/wex/${term}`,
      { waitUntil: 'domcontentloaded', timeout: 12000 }
    ).catch(() => {})
    
    const pageTitle = await page.title().catch(() => '')
    if (pageTitle && !pageTitle.toLowerCase().includes('page not found') && !pageTitle.toLowerCase().includes('404')) {
      const content = await page.$eval('.content, #content, article, main', (el: Element) => {
        return el.textContent?.trim().slice(0, 500) || ''
      }).catch(() => '')
      
      results.push({
        title: pageTitle.replace(/\s*\|.*$/, ''),
        citation: 'Cornell Legal Information Institute (Wex)',
        snippet: content || `Legal overview from Cornell Law School LII on ${query}.`,
        url: `https://www.law.cornell.edu/wex/${term}`,
        source: 'cornell_lii',
      })
    }
  } catch (err) {
    console.error('[solari] Cornell LII search failed:', err)
  } finally {
    await page.close()
  }
  
  return results.slice(0, maxResults)
}

// ─── Justia ──────────────────────────────────────────────────────

export async function searchJustia(
  browser: SolariSession['browser'],
  query: string,
  maxResults = 5
): Promise<LegalSource[]> {
  const page = await browser.newPage()
  const results: LegalSource[] = []
  
  try {
    const encodedQuery = encodeURIComponent(query)
    await page.goto(
      `https://supreme.justia.com/search?q=${encodedQuery}`,
      { waitUntil: 'domcontentloaded', timeout: 12000 }
    )
    
    await page.waitForSelector('.search-results, .results, .result, article', { timeout: 6000 }).catch(() => {})
    
    const items = await page.$$eval('.search-results-list .result, .results .result, article', (elements: Element[]) => {
      return elements.slice(0, 10).map(el => {
        const titleEl = el.querySelector('a.result-title, h3 a, h2 a, a')
        const snippetEl = el.querySelector('.result-snippet, p, .snippet')
        return {
          title: titleEl?.textContent?.trim() || '',
          url: (titleEl as HTMLAnchorElement)?.href || '',
          snippet: snippetEl?.textContent?.trim() || '',
        }
      })
    }).catch(() => [] as { title: string; url: string; snippet: string }[])
    
    for (const item of items.slice(0, maxResults)) {
      if (item.title && item.url) {
        results.push({
          title: item.title,
          citation: item.title,
          snippet: item.snippet.slice(0, 500),
          url: item.url,
          source: 'justia',
        })
      }
    }
  } catch (err) {
    console.error('[solari] Justia search failed:', err)
  } finally {
    await page.close()
  }
  
  return results
}

// ─── Helpers ─────────────────────────────────────────────────────

function extractYear(text: string): string | undefined {
  const match = text.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : undefined
}
