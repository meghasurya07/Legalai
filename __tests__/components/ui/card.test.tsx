import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from '@/components/ui/card'

describe('Card', () => {
    it('renders a full card with all subcomponents', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle>Title</CardTitle>
                    <CardDescription>Description</CardDescription>
                </CardHeader>
                <CardContent>Body content</CardContent>
                <CardFooter>Footer content</CardFooter>
            </Card>
        )

        expect(screen.getByText('Title')).toBeInTheDocument()
        expect(screen.getByText('Description')).toBeInTheDocument()
        expect(screen.getByText('Body content')).toBeInTheDocument()
        expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('Card has data-slot="card"', () => {
        const { container } = render(<Card>Content</Card>)
        const card = container.querySelector('[data-slot="card"]')
        expect(card).toBeInTheDocument()
    })

    it('CardHeader has data-slot="card-header"', () => {
        const { container } = render(
            <Card>
                <CardHeader>Header</CardHeader>
            </Card>
        )
        expect(container.querySelector('[data-slot="card-header"]')).toBeInTheDocument()
    })

    it('CardContent has data-slot="card-content"', () => {
        const { container } = render(
            <Card>
                <CardContent>Content</CardContent>
            </Card>
        )
        expect(container.querySelector('[data-slot="card-content"]')).toBeInTheDocument()
    })

    it('CardFooter has data-slot="card-footer"', () => {
        const { container } = render(
            <Card>
                <CardFooter>Footer</CardFooter>
            </Card>
        )
        expect(container.querySelector('[data-slot="card-footer"]')).toBeInTheDocument()
    })

    it('passes through custom className', () => {
        const { container } = render(<Card className="my-card">Content</Card>)
        const card = container.querySelector('[data-slot="card"]')
        expect(card?.className).toContain('my-card')
    })
})
