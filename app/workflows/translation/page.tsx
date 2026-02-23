import { Metadata } from 'next'
import Translation from '@/components/translation'

export const metadata: Metadata = {
    title: 'Translation | Legal AI',
    description: 'Translate legal documents with preserved legal terminology',
}

export default function TranslationPage() {
    return <Translation />
}
