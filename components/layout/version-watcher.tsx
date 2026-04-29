/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"

export function VersionWatcher() {
    const toastShownRef = useRef(false)
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const showUpdateToast = useCallback(() => {
        toast.custom((t) => (
            <div className="flex flex-col gap-3 w-[356px] bg-card border border-border p-4 rounded-xl shadow-lg text-foreground">
                <div className="flex gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                        <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center">
                            <Info className="w-3.5 h-3.5 text-primary" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] font-semibold leading-snug text-foreground">The platform has been updated</p>
                        <p className="text-[13px] text-muted-foreground">Please refresh the page to see changes.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                    <button
                        onClick={() => toast.dismiss(t)}
                        className="px-3 py-1.5 text-[13px] font-medium text-muted-foreground bg-secondary hover:bg-accent border border-border rounded-md transition-colors"
                    >
                        Not now
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-3 py-1.5 text-[13px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        ), {
            duration: Infinity,
            position: 'bottom-right'
        })
    }, [])

    const checkVersion = useCallback(async () => {
        // Stop checking if we already showed the toast
        if (toastShownRef.current) return

        try {
            const res = await fetch('/api/version', { cache: 'no-store' })
            if (!res.ok) return
            const data = await res.json()
            const fetchedVersion = data.version

            // We store the initial version in a module-level variable to avoid React state re-renders
            // since this component renders nothing and shouldn't trigger tree updates
            const currentVersion = window.sessionStorage.getItem('app-version')

            if (!currentVersion) {
                // First check, just store it
                window.sessionStorage.setItem('app-version', fetchedVersion)
            } else if (currentVersion !== fetchedVersion) {
                // Version changed — a new deployment happened, show toast
                showUpdateToast()
                toastShownRef.current = true
                // Update stored version so we don't keep showing it if they dismiss
                window.sessionStorage.setItem('app-version', fetchedVersion)
            }
        } catch (error) {
        }
    }, [showUpdateToast])

    useEffect(() => {
        // Don't run on server
        if (typeof window === 'undefined') return

        // Initial check to set the baseline version
        checkVersion()

        // Check every 5 minutes
        checkIntervalRef.current = setInterval(checkVersion, 5 * 60 * 1000)

        // Also check when user returns to the tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersion()
            }
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [checkVersion])

    // This component renders nothing, it just manages the background polling
    return null
}
