import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { extractText } from '@/lib/ai/extract-text'
import { getUserId } from '@/lib/auth/get-user-id'
import { checkRateLimit, RATE_LIMIT_AI } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) return apiError('Unauthorized', 401)

        const { allowed } = checkRateLimit(userId, RATE_LIMIT_AI)
        if (!allowed) return apiError('Too many requests', 429)

        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return apiError('No file provided', 400)
        }

        const { validateFileUpload } = await import('@/lib/validation')
        const validation = validateFileUpload(file)
        if (!validation.valid) {
            return apiError(validation.error || 'Invalid file', 400)
        }

        const extractedText = await extractText(file)
        return Response.json({ text: extractedText.trim() })

    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
