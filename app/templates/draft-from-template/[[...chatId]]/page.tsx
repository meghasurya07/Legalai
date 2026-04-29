import { Metadata } from 'next'
import DraftFromTemplate from '@/components/templates/draft-from-template'

export const metadata: Metadata = {
    title: 'Draft from Template | Wesley',
    description: 'Generate legal documents from templates',
}

export default function DraftFromTemplatePage() {
    return <DraftFromTemplate />
}
