import { Solari } from '@solarisdk/browser'

// Types
export interface SolariSession {
  sessionId: string
  browser: Awaited<ReturnType<Solari['launch']>>
  startedAt: Date
}

// Singleton client
let solariInstance: Solari | null = null

function getSolariClient(): Solari {
  if (!solariInstance) {
    const apiKey = process.env.SOLARI_API_KEY
    if (!apiKey) {
      throw new Error('SOLARI_API_KEY environment variable is required. Get one at console.getsolari.com')
    }
    solariInstance = new Solari({ apiKey })
  }
  return solariInstance
}

/**
 * Launch a stealth research browser session with recording enabled.
 * Uses US proxy for accessing US legal databases.
 */
export async function launchResearchSession(): Promise<SolariSession> {
  const client = getSolariClient()
  const browser = await client.launch({
    stealth: true,
    proxy: 'us',
    captcha: true,
    recording: true, // Enable session recording for legal audit trail
  })
  return {
    sessionId: (browser as unknown as Record<string, string>).sessionId || `session_${Date.now()}`,
    browser,
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
  return !!process.env.SOLARI_API_KEY
}
