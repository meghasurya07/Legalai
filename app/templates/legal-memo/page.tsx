import { Metadata } from 'next'
import LegalMemo from '@/components/legal-memo'

export const metadata: Metadata = {
    title: 'Legal Memo | Wesley',
    description: 'Draft legal research memos and analysis',
}

export default function LegalMemoPage() {
    return <LegalMemo />
}
