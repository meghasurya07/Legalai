import { Metadata } from 'next'
import ContractAnalysis from '@/components/templates/contract-analysis'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Contract Analysis | Wesley',
    description: 'Analyze contracts for key terms, risks, and obligations',
}

export default function ContractAnalysisPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <ContractAnalysis />
        </Suspense>
    )
}
