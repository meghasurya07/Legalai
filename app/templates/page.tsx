import { Metadata } from 'next'
import WorkflowsPage from '@/components/templates/templates-page'

export const metadata: Metadata = {
    title: 'Templates | Wesley',
    description: 'Use specialized workflows to tackle complex matters',
}

export default function TemplatesPage() {
    return <WorkflowsPage />
}
