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
      `https://scholar.google.com/scholar?hl=en&as_sdt=4&q=${encodedQuery}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    )
    
    // Wait for results to load
    await page.waitForSelector('.gs_r', { timeout: 10000 }).catch(() => {})
    
    // Extract search results
    const items = await page.$$eval('.gs_r.gs_or', (elements: Element[]) => {
      return elements.slice(0, 10).map(el => {
        const titleEl = el.querySelector('.gs_rt a')
        const snippetEl = el.querySelector('.gs_rs')
        const metaEl = el.querySelector('.gs_a')
        return {
          title: titleEl?.textContent?.trim() || '',
          url: (titleEl as HTMLAnchorElement)?.href || '',
          snippet: snippetEl?.textContent?.trim() || '',
          meta: metaEl?.textContent?.trim() || '',
        }
      })
    }).catch(() => [] as { title: string; url: string; snippet: string; meta: string }[])
    
    for (const item of items.slice(0, maxResults)) {
      if (item.title && item.url) {
        results.push({
          title: item.title,
          citation: item.meta,
          snippet: item.snippet.slice(0, 500),
          url: item.url,
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
    const encodedQuery = encodeURIComponent(query)
    await page.goto(
      `https://www.law.cornell.edu/search/site/${encodedQuery}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    )
    
    await page.waitForSelector('.search-result', { timeout: 10000 }).catch(() => {})
    
    const items = await page.$$eval('.search-result', (elements: Element[]) => {
      return elements.slice(0, 10).map(el => {
        const titleEl = el.querySelector('h3 a')
        const snippetEl = el.querySelector('.search-snippet')
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
          url: item.url.startsWith('http') ? item.url : `https://www.law.cornell.edu${item.url}`,
          source: 'cornell_lii',
        })
      }
    }
  } catch (err) {
    console.error('[solari] Cornell LII search failed:', err)
  } finally {
    await page.close()
  }
  
  return results
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
      `https://www.justia.com/search?q=${encodedQuery}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    )
    
    await page.waitForSelector('.search-results-list', { timeout: 10000 }).catch(() => {})
    
    const items = await page.$$eval('.search-results-list .result', (elements: Element[]) => {
      return elements.slice(0, 10).map(el => {
        const titleEl = el.querySelector('a.result-title')
        const snippetEl = el.querySelector('.result-snippet')
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
