/**
 * UI Action Engine — Performs programmatic UI actions on behalf of the voice agent.
 * 
 * These actions let Wesley visually interact with the UI while speaking,
 * so the user can see what's happening in real-time.
 */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { toast } from "sonner"

/**
 * Navigate to a page in the Wesley app.
 */
export function navigateTo(router: AppRouterInstance, page: string): void {
    const routes: Record<string, string> = {
        calendar: "/calendar",
        documents: "/documents",
        workflows: "/templates",
        chat: "/chat",
        settings: "/settings",
        "prompt-library": "/prompt-library",
    }

    const route = routes[page]
    if (route) {
        router.push(route)
    }
}

/**
 * Highlight an element on the page with a glow animation.
 * Used when Wesley refers to a specific UI element.
 */
export function highlightElement(elementId: string): void {
    const el = document.getElementById(elementId)
    if (!el) return

    // Scroll into view
    el.scrollIntoView({ behavior: "smooth", block: "center" })

    // Add glow effect
    el.classList.add("wesley-highlight")

    // Remove after animation
    setTimeout(() => {
        el.classList.remove("wesley-highlight")
    }, 3000)
}

/**
 * Open a modal by dispatching a custom event.
 * Components listen for this event to open their modals.
 */
export function openModal(modalType: string, data?: Record<string, unknown>): void {
    window.dispatchEvent(
        new CustomEvent("wesley-open-modal", {
            detail: { type: modalType, data },
        })
    )
}

/**
 * Show a toast notification from the voice agent.
 */
export function showToast(
    message: string,
    type: "success" | "error" | "info" = "info"
): void {
    switch (type) {
        case "success":
            toast.success(message, { duration: 4000 })
            break
        case "error":
            toast.error(message, { duration: 5000 })
            break
        default:
            toast.info(message, { duration: 4000 })
    }
}

/**
 * CSS class for the highlight animation.
 * This should be injected once into the page.
 */
export const HIGHLIGHT_STYLES = `
.wesley-highlight {
    position: relative;
    z-index: 10;
    outline: 2px solid hsl(250, 70%, 60%) !important;
    outline-offset: 4px;
    border-radius: 8px;
    animation: wesleyGlow 1.5s ease-in-out 2;
}

@keyframes wesleyGlow {
    0%, 100% { outline-color: hsl(250, 70%, 60%); box-shadow: 0 0 0 0 hsla(250, 70%, 60%, 0); }
    50% { outline-color: hsl(250, 80%, 70%); box-shadow: 0 0 20px 4px hsla(250, 70%, 60%, 0.3); }
}
`
