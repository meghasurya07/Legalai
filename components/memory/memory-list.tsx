"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, User, Briefcase, Building2 } from "lucide-react"
import MemoryCard, { type MemoryItem } from "./memory-card"

// ─── Types ───────────────────────────────────────────────

type MemoryCategory = 'personal' | 'case' | 'firm'

interface CategoryConfig {
    key: MemoryCategory
    label: string
    icon: typeof User
    description: string
    types: string[]
}

const CATEGORIES: CategoryConfig[] = [
    {
        key: 'personal',
        label: 'Personal',
        icon: User,
        description: 'Your preferences and corrections',
        types: ['preference', 'correction'],
    },
    {
        key: 'case',
        label: 'Case Intelligence',
        icon: Briefcase,
        description: 'Facts, decisions, risks, and insights from this matter',
        types: ['fact', 'decision', 'risk', 'obligation', 'insight', 'argument', 'outcome', 'procedure'],
    },
    {
        key: 'firm',
        label: 'Firm Patterns',
        icon: Building2,
        description: 'Cross-case patterns and institutional knowledge',
        types: ['pattern'],
    },
]

// ─── Main Component ──────────────────────────────────────

interface MemoryListProps {
    memories: MemoryItem[]
    onPin: (mem: MemoryItem) => void
    onDelete: (id: string) => void
    onSave: (id: string, content: string) => void
    onConfirmPreference?: (id: string) => void
    view: 'flat' | 'categorized'
}

export default function MemoryList({
    memories,
    onPin,
    onDelete,
    onSave,
    onConfirmPreference,
    view,
}: MemoryListProps) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

    const categorized = useMemo(() => {
        const result: Record<MemoryCategory, MemoryItem[]> = {
            personal: [],
            case: [],
            firm: [],
        }

        for (const mem of memories) {
            const category = CATEGORIES.find(c => c.types.includes(mem.memory_type))
            if (category) {
                result[category.key].push(mem)
            } else {
                result.case.push(mem)
            }
        }

        return result
    }, [memories])

    if (view === 'flat') {
        return (
            <div className="space-y-2">
                {memories.map(mem => (
                    <MemoryCard
                        key={mem.id}
                        memory={mem}
                        onPin={onPin}
                        onDelete={onDelete}
                        onSave={onSave}
                        onConfirmPreference={onConfirmPreference}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {CATEGORIES.map(category => {
                const items = categorized[category.key]
                if (items.length === 0) return null

                const isCollapsed = collapsed[category.key]
                const Icon = category.icon

                return (
                    <div key={category.key}>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 h-auto py-2 px-3 hover:bg-muted/50"
                            onClick={() => setCollapsed(prev => ({
                                ...prev,
                                [category.key]: !prev[category.key],
                            }))}
                        >
                            {isCollapsed
                                ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{category.label}</span>
                            <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                {items.length}
                            </span>
                        </Button>

                        {!isCollapsed && (
                            <div className="space-y-2 mt-2 ml-2 pl-4 border-l border-muted">
                                {items.map(mem => (
                                    <MemoryCard
                                        key={mem.id}
                                        memory={mem}
                                        onPin={onPin}
                                        onDelete={onDelete}
                                        onSave={onSave}
                                        onConfirmPreference={onConfirmPreference}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
