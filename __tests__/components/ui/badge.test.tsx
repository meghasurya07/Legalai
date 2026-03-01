import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
    it('renders children text', () => {
        render(<Badge>Active</Badge>)
        expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('sets the data-slot attribute', () => {
        render(<Badge>Status</Badge>)
        expect(screen.getByText('Status')).toHaveAttribute('data-slot', 'badge')
    })

    it('renders as a span by default', () => {
        render(<Badge>Label</Badge>)
        const el = screen.getByText('Label')
        expect(el.tagName).toBe('SPAN')
    })

    it('passes through additional className', () => {
        render(<Badge className="custom-class">Styled</Badge>)
        const el = screen.getByText('Styled')
        expect(el.className).toContain('custom-class')
    })

    it('renders with destructive variant', () => {
        render(<Badge variant="destructive">Error</Badge>)
        const el = screen.getByText('Error')
        expect(el.className).toContain('destructive')
    })

    it('renders with secondary variant', () => {
        render(<Badge variant="secondary">Info</Badge>)
        const el = screen.getByText('Info')
        expect(el.className).toContain('secondary')
    })
})
