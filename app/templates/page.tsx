import { Metadata } from 'next'
import WorkflowsPage from '../../components/templates-page'

export const metadata: Metadata = {
    title: 'Templates | Legal AI',
    description: 'Use specialized workflows to tackle complex matters',
}

export default function TemplatesPage() {
    return <WorkflowsPage />
}
