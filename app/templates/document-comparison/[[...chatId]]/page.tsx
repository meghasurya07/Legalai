import { Metadata } from 'next'
import DocumentComparison from '@/components/templates/document-comparison'

export const metadata: Metadata = {
    title: 'Document Comparison | Wesley',
    description: 'Compare legal documents and analyze material differences',
}

export default function DocumentComparisonPage() {
    return <DocumentComparison />
}
