import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'

describe('Input', () => {
    it('renders an input element', () => {
        render(<Input placeholder="Enter text" />)
        expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('sets the type attribute', () => {
        render(<Input type="email" placeholder="Email" />)
        const input = screen.getByPlaceholderText('Email')
        expect(input).toHaveAttribute('type', 'email')
    })

    it('sets data-slot="input"', () => {
        render(<Input placeholder="Test" />)
        const input = screen.getByPlaceholderText('Test')
        expect(input).toHaveAttribute('data-slot', 'input')
    })

    it('accepts user input', async () => {
        const user = userEvent.setup()
        render(<Input placeholder="Type here" />)

        const input = screen.getByPlaceholderText('Type here')
        await user.type(input, 'Hello world')

        expect(input).toHaveValue('Hello world')
    })

    it('can be disabled', () => {
        render(<Input disabled placeholder="Disabled" />)
        expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
    })

    it('passes through custom className', () => {
        render(<Input className="custom-input" placeholder="Styled" />)
        const input = screen.getByPlaceholderText('Styled')
        expect(input.className).toContain('custom-input')
    })
})
