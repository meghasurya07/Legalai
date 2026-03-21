import { Metadata } from 'next'
import RedlineAnalysis from '@/components/redline-analysis'

export const metadata: Metadata = {
    title: 'Redline Analysis | Wesley',
    description: 'Compare document versions and analyze changes with AI',
}

export default function RedlineAnalysisPage() {
    return <RedlineAnalysis />
}
