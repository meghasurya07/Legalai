import { Metadata } from 'next'
import CompanyProfile from '@/components/company-profile'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Company Research Profile | Wesley',
    description: 'Generate comprehensive reports on public companies',
}

export default function CompanyProfilePage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <CompanyProfile />
        </Suspense>
    )
}
