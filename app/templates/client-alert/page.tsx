import { Metadata } from 'next'
import ClientAlert from '@/components/client-alert'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Client Alert | Wesley',
    description: 'Draft professional client alerts and legal updates',
}

export default function ClientAlertPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        }>
            <ClientAlert />
        </Suspense>
    )
}
