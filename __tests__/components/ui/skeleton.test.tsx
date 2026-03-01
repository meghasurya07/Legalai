import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton', () => {
    it('renders a div element', () => {
        const { container } = render(<Skeleton />)
        const el = container.querySelector('[data-slot="skeleton"]')
        expect(el).toBeInTheDocument()
        expect(el?.tagName).toBe('DIV')
    })

    it('has the animate-pulse class', () => {
        const { container } = render(<Skeleton />)
        const el = container.querySelector('[data-slot="skeleton"]')
        expect(el?.className).toContain('animate-pulse')
    })

    it('passes through custom className', () => {
        const { container } = render(<Skeleton className="h-10 w-full" />)
        const el = container.querySelector('[data-slot="skeleton"]')
        expect(el?.className).toContain('h-10')
        expect(el?.className).toContain('w-full')
    })

    it('accepts and renders children', () => {
        const { container } = render(
            <Skeleton>
                <span>Loading...</span>
            </Skeleton>
        )
        expect(container.textContent).toContain('Loading...')
    })
})
