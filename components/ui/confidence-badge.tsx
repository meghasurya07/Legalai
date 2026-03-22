import * as React from "react"
import { ShieldCheck, Target, AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
    if (!level) return null

    let colorClass = ""
    let icon = null
    let tooltipText = ""
    let displayLabel = ""

    switch (level) {
        case "HIGH":
            colorClass = "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30"
            icon = <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            tooltipText = "High Confidence: Verified directly against the uploaded context."
            displayLabel = "High Confidence"
            break
        case "MEDIUM":
            colorClass = "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30"
            icon = <Target className="w-3.5 h-3.5 mr-1" />
            tooltipText = "Medium Confidence: Synthesized or implied by the context, but not explicitly stated."
            displayLabel = "Medium Confidence"
            break
        case "LOW":
            colorClass = "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30"
            icon = <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            tooltipText = "Low / Unverified: No direct source found in the uploaded documents. Please verify manually."
            displayLabel = "Unverified"
            break
    }

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <span className={`inline-flex items-center mx-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase cursor-default ${colorClass}`}>
                        {icon}
                        {displayLabel}
                    </span>
                </TooltipTrigger>
                <TooltipContent align="center" className="max-w-[250px] text-center">
                    <p className="text-xs">{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
