/**
 * Shared prompt category metadata — used by slash autocomplete,
 * prompt popover, and marquee chips.
 */

import { Briefcase, Scale, ShieldCheck, FileText, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────

export interface PromptItem {
    id: string
    title: string
    content: string
    description: string | null
    category: string
    type: string
}

export interface CategoryMeta {
    icon: LucideIcon
    color: string
    label: string
    theme: string
}

// ─── Category Resolver ───────────────────────────────────────────

export function getCategoryMeta(category: string | null | undefined): CategoryMeta {
    const cat = (category || "General").toLowerCase()

    if (cat.includes("corp") || cat.includes("m&a") || cat.includes("business")) {
        return {
            icon: Briefcase,
            color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
            label: "Corporate",
            theme: "amber"
        }
    }
    if (cat.includes("litig") || cat.includes("court") || cat.includes("gavel")) {
        return {
            icon: Scale,
            color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
            label: "Litigation",
            theme: "rose"
        }
    }
    if (cat.includes("compliance") || cat.includes("risk") || cat.includes("regulatory")) {
        return {
            icon: ShieldCheck,
            color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
            label: "Compliance",
            theme: "emerald"
        }
    }
    if (cat.includes("nda") || cat.includes("contract") || cat.includes("agree")) {
        return {
            icon: FileText,
            color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
            label: "Contracts",
            theme: "blue"
        }
    }
    return {
        icon: Sparkles,
        color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        label: "General",
        theme: "indigo"
    }
}
