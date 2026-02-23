import { Metadata } from 'next'
import WorkflowsPage from '@/components/workflows-page'

export const metadata: Metadata = {
    title: 'Templates | Legal AI',
    description: 'Use specialized workflows to tackle complex matters',
}

export default function Workflows() {
    return <WorkflowsPage />
}
