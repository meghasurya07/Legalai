import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { sessionId } = await params

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
  }

  // Construct the Solari console replay URL
  const replayUrl = `https://console.getsolari.com/sessions/${sessionId}/replay`

  return NextResponse.json({
    success: true,
    data: {
      sessionId,
      replayUrl,
      message: 'Open the replay URL in your browser to watch the research session recording.',
    },
  })
}
