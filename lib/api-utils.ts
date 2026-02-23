import { NextResponse } from 'next/server'

/**
 * Normalized API response envelope.
 * All API responses share this shape.
 */

/**
 * Standardized API error response
 */
export function apiError(message: string, status: number = 500, detail?: unknown) {
    console.error(`[API ERROR] status=${status} | message=${message}`, detail || '')
    return NextResponse.json({
        success: false,
        data: null,
        error: { code: status, message },
        ...(detail ? { meta: { detail } } : {})
    }, { status })
}

/**
 * Standardized API success response (JSON)
 */
export function apiSuccess(data: unknown, meta?: Record<string, unknown>) {
    return NextResponse.json({
        success: true,
        data,
        error: null,
        ...(meta ? { meta } : {})
    })
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
