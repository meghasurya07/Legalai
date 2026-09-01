import { chromium } from 'patchright-core'

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

export interface SolariSession {
  sessionId: string
  browser: SolariBrowser
  startedAt: Date
}

const DEFAULT_SOLARI_KEY = 'slr_live_axzp_mh09l2ZdkiuoRLW3-nyxtSNhMih8FgcVZyKIVNEVF0w'

export function getSolariApiKey(): string {
  return process.env.SOLARI_API_KEY || DEFAULT_SOLARI_KEY
}

/**
 * Launch a stealth research browser session with recording enabled.
 * Connects directly to Solari's cloud WebSocket gateway.
 */
export async function launchResearchSession(): Promise<SolariSession> {
  const apiKey = getSolariApiKey()
  if (!apiKey) {
    throw new Error('SOLARI_API_KEY environment variable is required. Get one at console.getsolari.com')
  }

  // 1. Create session via Solari REST API
  const res = await fetch('https://api.getsolari.com/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stealth: true,
      captcha: true,
      recording: true,
      proxy: {
        country: 'us',
      },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`Failed to create Solari browser session (${res.status}): ${errorText}`)
  }

  const sessionData = (await res.json()) as {
    sessionId: string
    wsEndpoint: string
    cdpEndpoint?: string
    expiresAt?: string
  }

  // 2. Connect directly to Solari cloud browser over WebSocket
  const browser = await chromium.connect(sessionData.wsEndpoint)

  return {
    sessionId: sessionData.sessionId,
    browser: {
      newPage: () => browser.newPage() as unknown as Promise<SolariPage>,
      close: () => browser.close(),
      id: sessionData.sessionId,
    },
    startedAt: new Date(),
  }
}

/**
 * Scrape content from a URL using the Solari browser.
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
      await page.waitForSelector(options.waitForSelector, { timeout: 8000 }).catch(() => {})
    }
    
    const title = await page.title()
    
    let content: string
    if (options.contentSelector) {
      content = await page.$eval(options.contentSelector, (el: Element) => el.textContent || '').catch(() => '')
    } else {
      content = await page.$eval('body', (el: Element) => el.textContent || '').catch(() => '')
    }
    
    return { title, content: content.slice(0, 15000), url }
  } finally {
    await page.close()
  }
}

/**
 * Safely close a browser session and release the Solari cloud concurrency slot.
 */
export async function closeSession(session: SolariSession): Promise<void> {
  try {
    await session.browser.close()
  } catch (err) {
    console.error('[solari] Failed to close browser:', err)
  }

  // Release session on Solari cloud
  if (session.sessionId) {
    try {
      const apiKey = getSolariApiKey()
      const enc = encodeURIComponent(session.sessionId)
      await fetch(`https://api.getsolari.com/sessions/${enc}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })
    } catch {
      // Fire-and-forget
    }
  }
}

/**
 * Check if Solari is configured.
 */
export function isSolariConfigured(): boolean {
  return !!getSolariApiKey()
}
