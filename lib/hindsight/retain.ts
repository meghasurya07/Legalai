import { getHindsightClient, getUserBankId, getProjectBankId, isHindsightConfigured } from './client'
import { logger } from '@/lib/logger'

/**
 * Store a conversation turn (user question + assistant answer) in Hindsight.
 * Called after saving the assistant response to Supabase.
 * Runs fire-and-forget to avoid blocking the response stream.
 */
export async function retainConversationTurn(params: {
  userId: string
  projectId?: string | null
  userMessage: string
  assistantResponse: string
  conversationId: string
  tags?: string[]
}): Promise<void> {
  if (!isHindsightConfigured()) return

  const { userId, projectId, userMessage, assistantResponse, conversationId, tags = [] } = params
  const client = getHindsightClient()

  // Truncate very long responses to stay within Hindsight limits
  const truncatedResponse = assistantResponse.slice(0, 8000)
  const content = `Legal Research Query: ${userMessage}\n\nWesley's Analysis: ${truncatedResponse}`

  const baseTags = ['source:wesley-chat', `conversation:${conversationId}`, ...tags]

  try {
    // 1. Retain in user bank (personal preferences & history)
    await client.retain(getUserBankId(userId), content, {
      tags: baseTags,
      async: true, // Fire-and-forget on the Hindsight server side
    })

    // 2. Retain in project bank if within a vault
    if (projectId) {
      await client.retain(getProjectBankId(projectId), content, {
        tags: [...baseTags, `project:${projectId}`],
        async: true,
      })
    }

    logger.info('hindsight/retain', `Retained conversation turn for user=${userId} project=${projectId || 'none'}`)
  } catch (err) {
    // Non-blocking — never crash chat for memory failures
    logger.error('hindsight/retain', 'Failed to retain conversation turn', err)
  }
}

/**
 * Store a legal research finding (from Solari web research) in Hindsight.
 */
export async function retainResearchFindings(params: {
  userId: string
  projectId?: string | null
  query: string
  sources: Array<{ title: string; citation: string; snippet: string; url: string }>
}): Promise<void> {
  if (!isHindsightConfigured()) return

  const { userId, projectId, query, sources } = params
  const client = getHindsightClient()

  if (sources.length === 0) return

  const content = [
    `Legal Research Query: ${query}`,
    '',
    'Sources Found:',
    ...sources.map((s, i) => `${i + 1}. ${s.title} — ${s.citation}\n   ${s.snippet}\n   URL: ${s.url}`),
  ].join('\n')

  try {
    await client.retain(getUserBankId(userId), content, {
      tags: ['source:web-research', 'type:case-law'],
      async: true,
    })

    if (projectId) {
      await client.retain(getProjectBankId(projectId), content, {
        tags: ['source:web-research', 'type:case-law', `project:${projectId}`],
        async: true,
      })
    }
  } catch (err) {
    logger.error('hindsight/retain', 'Failed to retain research findings', err)
  }
}
 
