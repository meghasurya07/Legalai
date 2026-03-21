import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
    it('renders text area element', () => {
        render(<Textarea placeholder="Type your message" />)
        expect(screen.getByPlaceholderText('Type your message')).toBeInTheDocument()
    })

    it('sets default data-slot attribute', () => {
        render(<Textarea aria-label="Comment" />)
        const textarea = screen.getByLabelText('Comment')
        expect(textarea).toHaveAttribute('data-slot', 'textarea')
    })

    it('passes through additional className', () => {
        render(<Textarea aria-label="Styled Textarea" className="custom-textarea-class" />)
        const textarea = screen.getByLabelText('Styled Textarea')
        expect(textarea.className).toContain('custom-textarea-class')
    })

    it('handles typing events', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()

        render(<Textarea aria-label="Input field" onChange={onChange} />)
        const textarea = screen.getByLabelText('Input field')
        
        await user.type(textarea, 'Hello World')
        expect(textarea).toHaveValue('Hello World')
        expect(onChange).toHaveBeenCalled()
    })

    it('is disabled when disabled prop is passed', () => {
        render(<Textarea aria-label="Disabled Textarea" disabled />)
        expect(screen.getByLabelText('Disabled Textarea')).toBeDisabled()
    })

    it('includes default styling classes', () => {
        render(<Textarea aria-label="Styled" />)
        const textarea = screen.getByLabelText('Styled')
        expect(textarea.className).toContain('flex')
        expect(textarea.className).toContain('min-h-16')
        expect(textarea.className).toContain('w-full')
        expect(textarea.className).toContain('rounded-md')
        expect(textarea.className).toContain('border')
    })
})
