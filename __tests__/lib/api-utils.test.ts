import { describe, it, expect, vi } from 'vitest'
import { parseAIJSON } from '@/lib/api-utils'

// We need to mock NextResponse since apiError/apiSuccess use it
vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({
            body,
            status: init?.status ?? 200,
        }),
    },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockResponse = { body: Record<string, any>; status: number }

const { apiError: _apiError } = await import('@/lib/api-utils')
const apiError = _apiError as (...args: Parameters<typeof _apiError>) => MockResponse

// ─── parseAIJSON ────────────────────────────────────────────────

describe('parseAIJSON', () => {
    it('parses valid JSON directly', () => {
        const result = parseAIJSON('{"key": "value"}')
        expect(result).toEqual({ key: 'value' })
    })

    it('parses JSON wrapped in markdown code block', () => {
        const input = 'Here is the result:\n```json\n{"analysis": "done"}\n```\nEnd.'
        const result = parseAIJSON(input)
        expect(result).toEqual({ analysis: 'done' })
    })

    it('extracts JSON object from surrounding text', () => {
        const input = 'Some preamble {"found": true} some postamble'
        const result = parseAIJSON(input)
        expect(result).toEqual({ found: true })
    })

    it('falls back with responseKey when JSON parsing fails entirely', () => {
        const result = parseAIJSON('plain text with no json', 'summary')
        expect(result).toEqual({ summary: 'plain text with no json' })
    })

    it('falls back to { result: text } when no responseKey given', () => {
        const result = parseAIJSON('just plain text')
        expect(result).toEqual({ result: 'just plain text' })
    })

    it('handles empty string input', () => {
        const result = parseAIJSON('')
        expect(result).toEqual({ result: '' })
    })

    it('parses JSON arrays', () => {
        const result = parseAIJSON('[1, 2, 3]')
        expect(result).toEqual([1, 2, 3])
    })
})

// ─── apiError ───────────────────────────────────────────────────

describe('apiError', () => {
    it('returns an error response with the correct status and body', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const response = apiError('Something went wrong', 400)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            success: false,
            data: null,
            error: { code: 400, message: 'Something went wrong' },
        })
        spy.mockRestore()
    })

    it('defaults to status 500', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const response = apiError('Server error')

        expect(response.status).toBe(500)
        expect(response.body.error.code).toBe(500)
        spy.mockRestore()
    })

    it('does not leak detail to client response', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const response = apiError('Fail', 422, { field: 'email' })

        // Detail should be logged server-side but NOT sent to client
        expect(response.body.meta).toBeUndefined()
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
    })
})
