import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { extractText } from '@/lib/ai/extract-text'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return apiError('No file provided', 400)
        }

        const extractedText = await extractText(file)
        return Response.json({ text: extractedText.trim() })

    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
