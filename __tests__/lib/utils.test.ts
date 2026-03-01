import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
    it('merges class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
        const isActive = true
        const isDisabled = false
        expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
    })

    it('deduplicates conflicting Tailwind classes', () => {
        // tailwind-merge should keep the last conflicting class
        expect(cn('px-2', 'px-4')).toBe('px-4')
    })

    it('handles empty inputs', () => {
        expect(cn()).toBe('')
    })

    it('handles undefined and null inputs', () => {
        expect(cn('base', undefined, null, 'end')).toBe('base end')
    })

    it('handles array inputs via clsx', () => {
        expect(cn(['foo', 'bar'])).toBe('foo bar')
    })
})
