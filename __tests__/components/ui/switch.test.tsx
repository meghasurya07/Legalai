import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
    it('renders the switch component', () => {
        render(<Switch aria-label="Toggle notifications" />)
        expect(screen.getByRole('switch', { name: 'Toggle notifications' })).toBeInTheDocument()
    })

    it('has data-state unchecked by default', () => {
        render(<Switch aria-label="Toggle setting" />)
        const switchBtn = screen.getByRole('switch', { name: 'Toggle setting' })
        expect(switchBtn).toHaveAttribute('data-state', 'unchecked')
    })

    it('can be toggled', async () => {
        const user = userEvent.setup()
        render(<Switch aria-label="Toggle feature" />)
        
        const switchBtn = screen.getByRole('switch', { name: 'Toggle feature' })
        expect(switchBtn).toHaveAttribute('data-state', 'unchecked')
        
        await user.click(switchBtn)
        // Radix switch uses internal state when uncontrolled
        expect(switchBtn).toHaveAttribute('data-state', 'checked')
        
        await user.click(switchBtn)
        expect(switchBtn).toHaveAttribute('data-state', 'unchecked')
    })

    it('passes through additional className', () => {
        render(<Switch aria-label="Styled Switch" className="custom-switch-class" />)
        const switchBtn = screen.getByRole('switch', { name: 'Styled Switch' })
        expect(switchBtn.className).toContain('custom-switch-class')
    })

    it('is disabled when disabled prop is passed', () => {
        render(<Switch aria-label="Disabled Switch" disabled />)
        const switchBtn = screen.getByRole('switch', { name: 'Disabled Switch' })
        expect(switchBtn).toBeDisabled()
        expect(switchBtn.className).toContain('disabled:cursor-not-allowed')
        expect(switchBtn.className).toContain('disabled:opacity-50')
    })

    it('supports controlled checked state', async () => {
        const user = userEvent.setup()
        let isChecked = false
        const onCheckedChange = (checked: boolean) => {
            isChecked = checked
        }

        render(<Switch aria-label="Controlled Switch" checked={isChecked} onCheckedChange={onCheckedChange} />)
        const switchBtn = screen.getByRole('switch', { name: 'Controlled Switch' })
        
        // Even if we click it, because we passed `checked={false}`, the component will call onCheckedChange but won't update its internal state on its own.
        // Radix calls the callback with the new state (true).
        await user.click(switchBtn)
        expect(isChecked).toBe(true)
    })
})
