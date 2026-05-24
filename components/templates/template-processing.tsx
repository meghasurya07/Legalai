"use client"

import * as React from "react"
import { Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ProcessingStep {
    label: string
    detail?: string
}

interface TemplateProcessingProps {
    /** Steps to display. The last incomplete step is shown as active. */
    steps: ProcessingStep[]
    /** Index of the currently active step (0-based) */
    activeStep?: number
    /** Elapsed time in seconds */
    elapsedSeconds?: number
    /** Accent color for the active step indicator */
    accentColor?: string
}

export function TemplateProcessing({
    steps,
    activeStep = 0,
    elapsedSeconds,
    accentColor = "text-primary",
}: TemplateProcessingProps) {
    return (
        <div className="max-w-md mx-auto py-12">
            <div className="space-y-4">
                {steps.map((step, i) => {
                    const isCompleted = i < activeStep
                    const isActive = i === activeStep
                    const isPending = i > activeStep

                    return (
                        <div
                            key={i}
                            className={cn(
                                "flex items-start gap-3 transition-all duration-500",
                                isPending && "opacity-40"
                            )}
                        >
                            {/* Step indicator */}
                            <div className="shrink-0 mt-0.5">
                                {isCompleted ? (
                                    <div className="h-6 w-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                ) : isActive ? (
                                    <div className={cn("h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center", accentColor.replace("text-", ""))}>
                                        <Loader2 className={cn("h-3.5 w-3.5 animate-spin", accentColor)} />
                                    </div>
                                ) : (
                                    <div className="h-6 w-6 rounded-full border-2 border-border/60 flex items-center justify-center">
                                        <span className="text-[10px] font-medium text-muted-foreground">{i + 1}</span>
                                    </div>
                                )}
                            </div>

                            {/* Step text */}
                            <div className="flex-1 min-w-0 pt-0.5">
                                <p className={cn(
                                    "text-sm font-medium transition-colors",
                                    isCompleted && "text-emerald-700 dark:text-emerald-400",
                                    isActive && "text-foreground",
                                    isPending && "text-muted-foreground"
                                )}>
                                    {step.label}
                                    {isCompleted && <span className="text-emerald-600 dark:text-emerald-400 ml-1.5 text-xs">✓</span>}
                                </p>
                                {step.detail && isActive && (
                                    <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in-0 duration-300">
                                        {step.detail}
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Elapsed time */}
            {elapsedSeconds !== undefined && (
                <div className="mt-6 text-center">
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {elapsedSeconds < 60
                            ? `${elapsedSeconds}s elapsed`
                            : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s elapsed`}
                    </p>
                </div>
            )}
        </div>
    )
}
