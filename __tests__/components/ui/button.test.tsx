import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button', () => {
    it('renders with children text', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('sets default data-variant attribute', () => {
        render(<Button>Default</Button>)
        const btn = screen.getByRole('button')
        expect(btn).toHaveAttribute('data-variant', 'default')
    })

    it('applies destructive variant', () => {
        render(<Button variant="destructive">Delete</Button>)
        const btn = screen.getByRole('button')
        expect(btn).toHaveAttribute('data-variant', 'destructive')
    })

    it('applies ghost variant', () => {
        render(<Button variant="ghost">Ghost</Button>)
        const btn = screen.getByRole('button')
        expect(btn).toHaveAttribute('data-variant', 'ghost')
    })

    it('applies outline variant', () => {
        render(<Button variant="outline">Outline</Button>)
        const btn = screen.getByRole('button')
        expect(btn).toHaveAttribute('data-variant', 'outline')
    })

    it('applies size data attribute', () => {
        render(<Button size="sm">Small</Button>)
        const btn = screen.getByRole('button')
        expect(btn).toHaveAttribute('data-size', 'sm')
    })

    it('sets the data-slot attribute', () => {
        render(<Button>Slot</Button>)
        const btn = screen.getByRole('button')
        expect(btn).toHaveAttribute('data-slot', 'button')
    })

    it('handles click events', async () => {
        const user = userEvent.setup()
        const onClick = vi.fn()

        render(<Button onClick={onClick}>Press</Button>)
        await user.click(screen.getByRole('button'))

        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('is disabled when disabled prop is passed', () => {
        render(<Button disabled>Disabled</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('passes through additional className', () => {
        render(<Button className="my-class">Styled</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('my-class')
    })
})
