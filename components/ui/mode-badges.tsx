"use client"

import { Brain, Globe, Sparkles } from "lucide-react"

interface ModeBadgesProps {
    isThinking: boolean
    isWebSearch: boolean
    isDeepResearch: boolean
    position?: "absolute" | "inline"
}

/**
 * Mode indicator badges (Reasoning Model / Web Search / Deep Research).
 * Used in the chat input area.
 */
export function ModeBadges({ isThinking, isWebSearch, isDeepResearch, position = "inline" }: ModeBadgesProps) {
    const hasAny = isThinking || isWebSearch || isDeepResearch
    if (!hasAny) return null

    const badges = (
        <div className="flex items-center gap-2">
            {isThinking && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-medium animate-in fade-in zoom-in-95 duration-200">
                    <Brain className="h-3 w-3" />
                    <span>Reasoning Model</span>
                </div>
            )}
            {isWebSearch && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-medium animate-in fade-in zoom-in-95 duration-200">
                    <Globe className="h-3 w-3" />
                    <span>Web Search</span>
                </div>
            )}
            {isDeepResearch && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium animate-in fade-in zoom-in-95 duration-200">
                    <Sparkles className="h-3 w-3" />
                    <span>Deep Research</span>
                </div>
            )}
        </div>
    )

    if (position === "absolute") {
        return (
            <div className="absolute top-3 left-4 flex items-center gap-2 z-10 pointer-events-none">
                {badges.props.children}
            </div>
        )
    }

    return (
        <div className="px-4 pt-3 flex items-center">
            {badges}
        </div>
    )
}
