import { getHindsightClient, getUserBankId, getProjectBankId, isHindsightConfigured } from './client'
import { logger } from '@/lib/logger'

// ─── Types ───────────────────────────────────────────────────────

export interface HindsightMemory {
  id: string
  text: string
  type: 'world' | 'experience' | 'observation'
  entities: string[]
  tags: string[]
  occurred_start?: string
  occurred_end?: string
  mentioned_at?: string
  source: 'hindsight'
}

export interface HindsightRecallResult {
  memories: HindsightMemory[]
  contextText: string
  count: number
}

// ─── Recall ──────────────────────────────────────────────────────

/**
 * Recall relevant memories from Hindsight for a given query.
 * Queries both the user bank and (optionally) the project bank,
 * then merges and deduplicates results.
 */
export async function recallHindsightMemories(params: {
  query: string
  userId: string
  projectId?: string | null
}): Promise<HindsightRecallResult> {
  if (!isHindsightConfigured()) {
    return { memories: [], contextText: '', count: 0 }
  }

  const { query, userId, projectId } = params
  const client = getHindsightClient()
  const allMemories: HindsightMemory[] = []

  try {
    // 1. Recall from user bank
    const userRecall = await client.recall(getUserBankId(userId), query, {
      budget: 'low', // Fast retrieval for chat latency
      maxTokens: 2000,
    })

    if (userRecall?.results) {
      for (const r of userRecall.results) {
        allMemories.push({
          id: r.id,
          text: r.text,
          type: r.type as HindsightMemory['type'],
          entities: r.entities || [],
          tags: r.tags || [],
          occurred_start: r.occurred_start ?? undefined,
          occurred_end: r.occurred_end ?? undefined,
          mentioned_at: r.mentioned_at ?? undefined,
          source: 'hindsight',
        })
      }
    }

    // 2. Recall from project bank (if within a vault)
    if (projectId) {
      const projectRecall = await client.recall(getProjectBankId(projectId), query, {
        budget: 'low',
        maxTokens: 1500,
      })

      if (projectRecall?.results) {
        for (const r of projectRecall.results) {
          // Deduplicate by text similarity
          const isDuplicate = allMemories.some(m => m.text === r.text)
          if (!isDuplicate) {
            allMemories.push({
              id: r.id,
              text: r.text,
              type: r.type as HindsightMemory['type'],
              entities: r.entities || [],
              tags: r.tags || [],
              occurred_start: r.occurred_start ?? undefined,
              occurred_end: r.occurred_end ?? undefined,
              mentioned_at: r.mentioned_at ?? undefined,
              source: 'hindsight',
            })
          }
        }
      }
    }

    // 3. Build context text for LLM injection
    const contextText = formatHindsightContext(allMemories)

    logger.info('hindsight/recall', `Recalled ${allMemories.length} memories for query "${query.slice(0, 60)}..."`)

    return {
      memories: allMemories,
      contextText,
      count: allMemories.length,
    }
  } catch (err) {
    logger.error('hindsight/recall', 'Failed to recall Hindsight memories', err)
    return { memories: [], contextText: '', count: 0 }
  }
}

// ─── Context Formatting ─────────────────────────────────────────

/**
 * Format Hindsight memories into a context block for the LLM system prompt.
 */
function formatHindsightContext(memories: HindsightMemory[]): string {
  if (memories.length === 0) return ''

  const lines: string[] = [
    '## 🧠 Long-Term Memory (Hindsight)',
    `Wesley has learned the following from your past legal research sessions (${memories.length} relevant memories):`,
    '',
  ]

  // Group by type
  const facts = memories.filter(m => m.type === 'world')
  const experiences = memories.filter(m => m.type === 'experience')
  const observations = memories.filter(m => m.type === 'observation')

  if (facts.length > 0) {
    lines.push('### Established Legal Facts')
    facts.forEach(m => lines.push(`- ${m.text}`))
    lines.push('')
  }

  if (observations.length > 0) {
    lines.push('### Learned Patterns & Preferences')
    observations.forEach(m => lines.push(`- ${m.text}`))
    lines.push('')
  }

  if (experiences.length > 0) {
    lines.push('### Past Research Context')
    experiences.forEach(m => lines.push(`- ${m.text}`))
    lines.push('')
  }

  lines.push(
    '[INSTRUCTION: Use these memories to personalize your response. Reference past research when relevant.',
    'If the user has a known jurisdiction preference, apply it. Build on prior case discussions rather than starting from scratch.]',
  )

  return lines.join('\n')
}
