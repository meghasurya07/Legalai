import { HindsightClient } from '@vectorize-io/hindsight-client'
import { logger } from '@/lib/logger'

// ─── Singleton Client ────────────────────────────────────────────

let hindsightInstance: HindsightClient | null = null

/**
 * Get or create the Hindsight client singleton.
 * Uses Hindsight Cloud by default, falls back to local.
 */
export function getHindsightClient(): HindsightClient {
  if (!hindsightInstance) {
    const baseUrl = process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io'
    const apiKey = process.env.HINDSIGHT_API_KEY

    if (!apiKey) {
      logger.warn('hindsight', 'HINDSIGHT_API_KEY not set — Hindsight memory will be unavailable')
    }

    hindsightInstance = new HindsightClient({
      baseUrl,
      ...(apiKey ? { apiKey } : {}),
    })
  }
  return hindsightInstance
}

/**
 * Check if Hindsight is configured and available.
 */
export function isHindsightConfigured(): boolean {
  return !!process.env.HINDSIGHT_API_KEY
}

// ─── Bank ID Utilities ───────────────────────────────────────────

/**
 * Generate a per-user Hindsight bank ID.
 * Stores personal preferences, jurisdiction habits, frequently referenced cases.
 */
export function getUserBankId(userId: string): string {
  // Sanitize Auth0 IDs (e.g., "auth0|abc123" → "auth0-abc123")
  const sanitized = userId.replace(/[|:]/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '')
  return `wesley-user-${sanitized}`
}

/**
 * Generate a per-project (vault) Hindsight bank ID.
 * Stores project-specific legal context, party names, case strategy.
 */
export function getProjectBankId(projectId: string): string {
  return `wesley-project-${projectId}`
}

/**
 * Generate the global Wesley bank ID.
 * Stores platform-wide legal knowledge and common patterns.
 */
export function getGlobalBankId(): string {
  return 'wesley-global'
}
 
