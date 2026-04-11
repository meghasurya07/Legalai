import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth/auth0'
import { apiError } from '@/lib/api-utils'
import { processFeedback } from '@/lib/memory/learning-loop'

/**
 * POST /api/memory/feedback — Link user ratings to memories used in responses
 *
 * Body: {
 *   conversationId: string,
 *   messageId: string,
 *   rating: 'positive' | 'negative',
 *   memoryIds: string[]  // memories that were used in the rated response
 * }
 */
export async function POST(request: NextRequest) {
    const session = await auth0.getSession()
    if (!session?.user) return apiError('Unauthorized', 401)

    const body = await request.json()
    const { conversationId, messageId, rating, memoryIds } = body

    if (!conversationId || !messageId) {
        return apiError('conversationId and messageId are required', 400)
    }

    if (rating !== 'positive' && rating !== 'negative') {
        return apiError('rating must be "positive" or "negative"', 400)
    }

    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
        return apiError('memoryIds must be a non-empty array', 400)
    }

    try {
        await processFeedback({
            conversationId,
            messageId,
            rating,
            memoryIds,
        })

        return NextResponse.json({
            success: true,
            processed: memoryIds.length,
            message: rating === 'positive'
                ? 'Memory confidence boosted'
                : 'Memory confidence reduced — flagged for review if below threshold',
        })
    } catch (err) {
        console.error('[Memory Feedback] Error:', err)
        return apiError('Failed to process feedback', 500)
    }
}
