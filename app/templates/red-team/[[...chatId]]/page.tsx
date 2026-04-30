import { Metadata } from 'next'
import RedTeam from '@/components/templates/red-team'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Red Team My Contract | Wesley',
    description: 'Simulate 6 opposing counsel personas attacking your contract to find loopholes and weak clauses',
}

export default function RedTeamPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <RedTeam />
        </Suspense>
    )
}
