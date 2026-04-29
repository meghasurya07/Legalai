import { Metadata } from 'next'
import RedlineAnalysis from '@/components/templates/redline-analysis'

export const metadata: Metadata = {
    title: 'Redline Analysis | Wesley',
    description: 'Compare document versions and analyze changes with AI',
}

export default function RedlineAnalysisPage() {
    return <RedlineAnalysis />
}
