import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { runLegalResearch, formatResearchContext, type ResearchSource } from '@/lib/solari/research-agent'
import { isSolariConfigured } from '@/lib/solari/client'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  if (!isSolariConfigured()) {
    return NextResponse.json(
      { error: 'Web research is not configured. SOLARI_API_KEY is missing.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { query, sources, maxResults } = body as {
      query: string
      sources?: ResearchSource[]
      maxResults?: number
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await runLegalResearch(query, {
      sources,
      maxResultsPerSource: maxResults || 5,
    })

    return NextResponse.json({
      success: true,
      data: result,
      context: formatResearchContext(result),
    })
  } catch (error) {
    console.error('[api/research/web] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Web research failed. Please try again.' },
      { status: 500 }
    )
  }
}
