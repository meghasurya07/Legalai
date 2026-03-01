"use client"

import "./not-found.css"
import Link from "next/link"
import { Home, ArrowLeft, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-full h-full w-full bg-background text-foreground p-4 relative overflow-hidden">
            {/* Animated background grid */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="not-found-grid absolute inset-0 opacity-[0.03]" />
                {/* Radial glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
            </div>

            <div className="flex flex-col items-center max-w-lg text-center space-y-8 relative z-10">
                {/* Animated 404 number */}
                <div className="relative select-none">
                    <h1 className="text-[10rem] sm:text-[12rem] font-black tracking-tighter leading-none bg-gradient-to-b from-foreground via-foreground/80 to-foreground/20 bg-clip-text text-transparent tabular-nums">
                        404
                    </h1>
                    {/* Glowing underline accent */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-1.5 w-24 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
                </div>

                {/* Description */}
                <div className="space-y-3">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                        This page doesn&apos;t exist
                    </h2>
                    <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-sm mx-auto">
                        The page you&apos;re looking for may have been moved, deleted, or never existed in the first place.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <Button asChild size="lg" className="gap-2 px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                        <Link href="/">
                            <Home className="h-4 w-4" />
                            Go Home
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="gap-2 px-6">
                        <Link href="/" onClick={(e) => { e.preventDefault(); history.back() }}>
                            <ArrowLeft className="h-4 w-4" />
                            Go Back
                        </Link>
                    </Button>
                </div>

                {/* Subtle help link */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 pt-4">
                    <Search className="h-3 w-3" />
                    <span>Try searching or navigating from the sidebar</span>
                </div>
            </div>
        </div>
    )
}
