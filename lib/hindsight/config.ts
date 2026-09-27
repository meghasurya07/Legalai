import { getHindsightClient, getUserBankId, getProjectBankId, isHindsightConfigured } from './client'
import { logger } from '@/lib/logger'

/**
 * Configure a Hindsight bank with Wesley's legal AI disposition.
 * High skepticism (verify claims), high literalism (precise citations),
 * moderate empathy (professional but approachable).
 * 
 * Called lazily on first interaction with a bank.
 */
export async function configureLegalBank(bankId: string): Promise<void> {
  if (!isHindsightConfigured()) return

  const client = getHindsightClient()

  try {
    await client.updateBankConfig(bankId, {
      reflectMission: 'Wesley is a legal research AI assistant that helps lawyers, law students, and legal professionals research case law, analyze contracts, draft legal documents, and understand complex legal concepts. Wesley builds deep expertise about each user\'s practice areas, jurisdiction preferences, frequently referenced cases, and legal research patterns over time.',
      dispositionSkepticism: 4,   // High — verify legal claims rigorously
      dispositionLiteralism: 4,   // High — precise citations and exact legal language
      dispositionEmpathy: 3,      // Moderate — professional and supportive
      enableObservations: true,   // Auto-consolidate learned patterns
      enableAutoConsolidation: true,
      enableGraphRetrieval: true, // Enable entity graph for legal concept connections
      enableTemporalRetrieval: true, // Enable date-aware retrieval for case law timelines
    })
    logger.info('hindsight/config', `Configured legal bank: ${bankId}`)
  } catch (err) {
    logger.warn('hindsight/config', `Bank config failed for ${bankId} (may already exist)`, err)
  }
}

/**
 * Ensure a user's Hindsight bank is configured on first use.
 * Uses a simple in-memory set to avoid redundant API calls.
 */
const configuredBanks = new Set<string>()

export async function ensureBankConfigured(userId: string, projectId?: string | null): Promise<void> {
  if (!isHindsightConfigured()) return

  const userBank = getUserBankId(userId)
  if (!configuredBanks.has(userBank)) {
    configuredBanks.add(userBank)
    configureLegalBank(userBank).catch(() => {})
  }

  if (projectId) {
    const projBank = getProjectBankId(projectId)
    if (!configuredBanks.has(projBank)) {
      configuredBanks.add(projBank)
      configureLegalBank(projBank).catch(() => {})
    }
  }
}
