import type { Solari as SolariType } from '@solarisdk/browser'

export interface SolariPage {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
  waitForSelector: (selector: string, options?: Record<string, unknown>) => Promise<unknown>
  title: () => Promise<string>
  $eval: (selector: string, fn: (el: Element) => string) => Promise<string>
  $$eval: <T>(selector: string, fn: (els: Element[]) => T) => Promise<T>
  close: () => Promise<void>
}

export interface SolariBrowser {
  newPage: () => Promise<SolariPage>
  close: () => Promise<void>
  id?: string
}

// Types
export interface SolariSession {
  sessionId: string
  browser: SolariBrowser
  startedAt: Date
}

const DEFAULT_SOLARI_KEY = 'slr_live_axzp_mh09l2ZdkiuoRLW3-nyxtSNhMih8FgcVZyKIVNEVF0w'

// Singleton client
let solariInstance: SolariType | null = null

async function getSolariClient(): Promise<SolariType> {
  if (!solariInstance) {
    const apiKey = process.env.SOLARI_API_KEY || DEFAULT_SOLARI_KEY
    if (!apiKey) {
      throw new Error('SOLARI_API_KEY environment variable is required. Get one at console.getsolari.com')
    }
    const { Solari } = await import('@solarisdk/browser')
    solariInstance = new Solari({ apiKey })
  }
  return solariInstance
}

/**
 * Launch a stealth research browser session with recording enabled.
 * Uses US proxy for accessing US legal databases.
 */
export async function launchResearchSession(): Promise<SolariSession> {
  const client = await getSolariClient()
  const browser = await client.launch({
    stealth: true,
    proxy: 'us',
    captcha: true,
    recording: true, // Enable session recording for legal audit trail
  })
  const sid = (browser as unknown as { id?: string }).id || `session_${Date.now()}`
  return {
    sessionId: sid,
    browser: browser as unknown as SolariSession['browser'],
    startedAt: new Date(),
  }
}

/**
 * Scrape content from a URL using the Solari browser.
 * @param browser - Active Solari browser instance
 * @param url - URL to scrape
 * @param options - Selectors and timeout config
 */
export async function scrapeUrl(
  browser: SolariSession['browser'],
  url: string,
  options: {
    waitForSelector?: string
    contentSelector?: string
    timeoutMs?: number
  } = {}
): Promise<{ title: string; content: string; url: string }> {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || 15000 })
    
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {})
    }
    
    const title = await page.title()
    
    let content: string
    if (options.contentSelector) {
      content = await page.$eval(options.contentSelector, (el: Element) => el.textContent || '').catch(() => '')
    } else {
      content = await page.$eval('body', (el: Element) => el.textContent || '').catch(() => '')
    }
    
    return { title, content: content.slice(0, 15000), url } // Cap at 15k chars
  } finally {
    await page.close()
  }
}

/**
 * Safely close a browser session. MUST be called to avoid hanging.
 */
export async function closeSession(session: SolariSession): Promise<void> {
  try {
    await session.browser.close()
  } catch (err) {
    console.error('[solari] Failed to close session:', err)
  }
}

/**
 * Check if Solari is configured.
 */
export function isSolariConfigured(): boolean {
  return !!(process.env.SOLARI_API_KEY || DEFAULT_SOLARI_KEY)
}
