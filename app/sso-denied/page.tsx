"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"

function SsoAccessDeniedContent() {
    const searchParams = useSearchParams()
    const reason = searchParams.get("reason") || "unknown"
    const org = searchParams.get("org") || "your organization"

    const messages: Record<string, { title: string; description: string }> = {
        seat_limit: {
            title: "Seat Limit Reached",
            description: `${org} has reached its maximum number of licensed seats. Please contact your administrator to add more seats or remove inactive users.`,
        },
        no_org: {
            title: "No Organization Found",
            description: "Your email domain is not associated with any organization on Wesley. Please contact your IT administrator to set up SSO for your domain.",
        },
        inactive: {
            title: "Organization Inactive",
            description: `${org} is currently inactive. Please contact your administrator or Wesley support to reactivate your organization.`,
        },
        unknown: {
            title: "Access Denied",
            description: "You don't have access to this organization. Please contact your administrator.",
        },
    }

    const msg = messages[reason] || messages.unknown

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">{msg.title}</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">{msg.description}</p>
                </div>
                <div className="pt-4 space-y-3">
                    <Link
                        href="/auth/login"
                        className="block w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Try a Different Account
                    </Link>
                    <Link
                        href="/"
                        className="block w-full px-4 py-2.5 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
                    >
                        Go Home
                    </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                    If you believe this is an error, contact <a href="mailto:support@askwesley.com" className="text-primary hover:underline">support@askwesley.com</a>
                </p>
            </div>
        </div>
    )
}

export default function SsoAccessDeniedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
            <SsoAccessDeniedContent />
        </Suspense>
    )
}
