"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ToolPageLayoutProps {
    title: string
    description: string
    children: React.ReactNode
    backHref?: string
    icon?: React.ReactNode
    accentColor?: string
}

export function ToolPageLayout({ title, description, children, backHref = '/templates', icon, accentColor }: ToolPageLayoutProps) {
    const router = useRouter()

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 pb-24 md:pb-32">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-8">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 shrink-0 h-8 w-8 rounded-lg"
                            onClick={() => router.push(backHref)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1">
                                {icon && (
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${accentColor || 'bg-primary/10 text-primary'}`}>
                                        {icon}
                                    </div>
                                )}
                                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                            </div>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}
