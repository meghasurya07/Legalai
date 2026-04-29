import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Standardized API Response Helpers
 *
 * Error responses use a consistent shape:
 *   { success: false, data: null, error: { code: number, message: string } }
 *
 * Success responses use `NextResponse.json(data)` directly.
 */

/**
 * Standardized API error response
 */
export function apiError(message: string, status: number = 500, detail?: unknown) {
    logger.error('api', `[${status}] ${message}`, detail)
    return NextResponse.json({
        success: false,
        data: null,
        error: { code: status, message }
    }, { status })
}

/**
 * Robust AI JSON parsing with fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAIJSON(text: string, responseKey?: string): any {
    try {
        // Try direct parse
        return JSON.parse(text)
    } catch {
        // Try to find JSON block in markdown
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/)
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1] || jsonMatch[0])
            } catch {
                // Return as wrapped object if still failing
            }
        }

        // Final fallback: wrap the raw text in the expected key
        return responseKey ? { [responseKey]: text } : { result: text }
    }
}
