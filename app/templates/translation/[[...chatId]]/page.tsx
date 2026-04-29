import { Metadata } from 'next'
import Translation from '@/components/templates/translation'

export const metadata: Metadata = {
    title: 'Translation | Wesley',
    description: 'Translate legal documents with preserved legal terminology',
}

export default function TranslationPage() {
    return <Translation />
}
