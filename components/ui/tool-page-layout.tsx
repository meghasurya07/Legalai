"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ToolPageLayoutProps {
    title: string
    description: string
    children: React.ReactNode
    backHref?: string
}

export function ToolPageLayout({ title, description, children, backHref = '/templates' }: ToolPageLayoutProps) {
    const router = useRouter()

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 pb-32">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
                            <p className="text-muted-foreground">{description}</p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}
