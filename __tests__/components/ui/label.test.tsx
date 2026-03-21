import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('Label', () => {
    it('renders with children text', () => {
        render(<Label htmlFor="test-input">Test Label</Label>)
        expect(screen.getByText('Test Label')).toBeInTheDocument()
    })

    it('sets default data-slot attribute', () => {
        render(<Label>Default</Label>)
        const label = screen.getByText('Default')
        expect(label).toHaveAttribute('data-slot', 'label')
    })

    it('passes through additional className', () => {
        render(<Label className="custom-label-class">Styled</Label>)
        const label = screen.getByText('Styled')
        expect(label.className).toContain('custom-label-class')
    })

    it('includes default styling classes', () => {
        render(<Label>Styletest</Label>)
        const label = screen.getByText('Styletest')
        expect(label.className).toContain('text-sm')
        expect(label.className).toContain('font-medium')
    })

    it('passes htmlFor attribute correctly', () => {
        render(<Label htmlFor="email-input">Email</Label>)
        const label = screen.getByText('Email')
        expect(label).toHaveAttribute('for', 'email-input')
    })
})
