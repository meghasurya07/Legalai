import { Metadata } from 'next'
import DraftFromTemplate from '@/components/draft-from-template'

export const metadata: Metadata = {
    title: 'Draft from Template | Legal AI',
    description: 'Generate legal documents from templates',
}

export default function DraftFromTemplatePage() {
    return <DraftFromTemplate />
}
