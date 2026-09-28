import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getHindsightClient, isHindsightConfigured, getUserBankId, getProjectBankId } from '@/lib/hindsight'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/**
 * Memory Insights API — uses Hindsight's REFLECT to synthesize
 * what Wesley has learned about a user or project.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof Response) return auth
  const { userId } = auth

  if (!isHindsightConfigured()) {
    return NextResponse.json(
      { error: 'Hindsight memory is not configured.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { projectId, query } = body as {
      projectId?: string
      query?: string
    }

    const client = getHindsightClient()
    const bankId = projectId ? getProjectBankId(projectId) : getUserBankId(userId)

    const defaultQuery = projectId
      ? 'What are the key legal themes, parties, case strategies, and important facts in this project? What patterns have emerged from the research?'
      : 'What are this user\'s legal research patterns, jurisdiction preferences, frequently referenced case law, and practice areas? How has their research evolved over time?'

    // 1. Reflect — synthesize insights from accumulated memories
    const reflection = await client.reflect(bankId, query || defaultQuery, {
      budget: 'mid',
      includeFacts: true,
    })

    // 2. Get memory count via recall with a broad query
    const recallResult = await client.recall(bankId, 'everything', {
      budget: 'low',
      maxTokens: 500,
    })

    const memoryCount = recallResult?.results?.length || 0

    // 3. Extract entity themes from recalled memories
    const entities = new Set<string>()
    if (recallResult?.results) {
      for (const r of recallResult.results) {
        if (r.entities) {
          for (const e of r.entities) {
            entities.add(e)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        insights: reflection.text,
        memoryCount,
        entities: Array.from(entities).slice(0, 20),
        basedOn: reflection.based_on,
        bankId,
        usage: reflection.usage,
      },
    })
  } catch (error) {
    logger.error('api/memory/insights', 'Reflect failed', error)
    return NextResponse.json(
      { error: 'Failed to generate memory insights.' },
      { status: 500 }
    )
  }
}

/**
 * GET — quick memory stats (count, entity list) without full reflection.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof Response) return auth
  const { userId } = auth

  if (!isHindsightConfigured()) {
    return NextResponse.json({ configured: false, memoryCount: 0, entities: [] })
  }

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const client = getHindsightClient()
    const bankId = projectId ? getProjectBankId(projectId) : getUserBankId(userId)

    const recallResult = await client.recall(bankId, 'summary of all learned facts and preferences', {
      budget: 'low',
      maxTokens: 500,
    })

    const memoryCount = recallResult?.results?.length || 0
    const entities = new Set<string>()
    const recentFacts: string[] = []

    if (recallResult?.results) {
      for (const r of recallResult.results) {
        if (r.entities) r.entities.forEach(e => entities.add(e))
        if (recentFacts.length < 5) recentFacts.push(r.text)
      }
    }

    return NextResponse.json({
      configured: true,
      memoryCount,
      entities: Array.from(entities).slice(0, 15),
      recentFacts,
      bankId,
    })
  } catch (error) {
    logger.error('api/memory/insights', 'Stats fetch failed', error)
    return NextResponse.json({ configured: true, memoryCount: 0, entities: [], recentFacts: [] })
  }
}
 
