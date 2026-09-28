"use client"

import * as React from "react"
import { Brain, Sparkles, TrendingUp, ChevronDown, ChevronUp, Loader2, BookOpen, Scale, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────────────

interface MemoryStats {
  configured: boolean
  memoryCount: number
  entities: string[]
  recentFacts: string[]
}

interface MemoryInsights {
  insights: string
  memoryCount: number
  entities: string[]
  basedOn?: {
    memories?: Array<{ id: string; text: string }>
    mental_models?: Array<{ id: string; title: string }>
  }
}

// ─── Learning Stage ──────────────────────────────────────────────

function getLearningStage(count: number): {
  label: string
  color: string
  bgColor: string
  description: string
  icon: React.ReactNode
} {
  if (count === 0) return {
    label: 'New',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    description: 'Wesley hasn\'t learned about your work yet',
    icon: <Brain className="h-3.5 w-3.5" />,
  }
  if (count <= 10) return {
    label: 'Learning',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'Wesley is starting to learn your preferences',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  }
  if (count <= 30) return {
    label: 'Adapting',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    description: 'Wesley is adapting to your legal research style',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  }
  return {
    label: 'Expert',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    description: 'Wesley deeply understands your legal work',
    icon: <Zap className="h-3.5 w-3.5" />,
  }
}

// ─── Component ───────────────────────────────────────────────────

interface MemoryPanelProps {
  projectId?: string | null
  className?: string
}

export function MemoryPanel({ projectId, className = '' }: MemoryPanelProps) {
  const [stats, setStats] = React.useState<MemoryStats | null>(null)
  const [insights, setInsights] = React.useState<MemoryInsights | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [loadingInsights, setLoadingInsights] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch memory stats on mount
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = projectId
          ? `/api/memory/insights?projectId=${projectId}`
          : '/api/memory/insights'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        // Silent — panel just won't show
      }
    }
    fetchStats()
  }, [projectId])

  // Fetch full insights on expand
  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)

    if (insights) return // Already loaded

    setLoadingInsights(true)
    setError(null)
    try {
      const res = await fetch('/api/memory/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (res.ok) {
        const data = await res.json()
        setInsights(data.data)
      } else {
        setError('Failed to load insights')
      }
    } catch {
      setError('Failed to connect')
    } finally {
      setLoadingInsights(false)
    }
  }

  // Don't render if Hindsight is not configured
  if (stats && !stats.configured) return null

  // Loading state
  if (!stats) return null

  const stage = getLearningStage(stats.memoryCount)

  return (
    <div className={`rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden ${className}`}>
      {/* Header — always visible */}
      <button
        onClick={handleExpand}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-muted/30 transition-colors"
      >
        <div className={`p-1.5 rounded-lg ${stage.bgColor}`}>
          <div className={stage.color}>
            {stage.icon}
          </div>
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground">
              Memory Intelligence
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${stage.bgColor} ${stage.color}`}>
              {stage.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            {stats.memoryCount > 0
              ? `${stats.memoryCount} learned facts • ${stats.entities.length} legal entities`
              : stage.description
            }
          </p>
        </div>
        <div className="text-muted-foreground">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/40">
          {/* Progress bar */}
          <div className="px-3 py-2 border-b border-border/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Learning Progress</span>
              <span className="text-[10px] font-medium text-foreground">{stats.memoryCount} memories</span>
            </div>
            <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.memoryCount === 0 ? 'bg-gray-400' :
                  stats.memoryCount <= 10 ? 'bg-blue-500' :
                  stats.memoryCount <= 30 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (stats.memoryCount / 50) * 100)}%` }}
              />
            </div>
          </div>

          {/* Entities */}
          {stats.entities.length > 0 && (
            <div className="px-3 py-2 border-b border-border/30">
              <span className="text-[10px] font-medium text-muted-foreground block mb-1.5">
                <Scale className="h-2.5 w-2.5 inline mr-1" />
                Learned Legal Entities
              </span>
              <div className="flex flex-wrap gap-1">
                {stats.entities.slice(0, 10).map((entity, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-primary/5 text-primary/80 border border-primary/10"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent facts */}
          {stats.recentFacts.length > 0 && (
            <div className="px-3 py-2 border-b border-border/30">
              <span className="text-[10px] font-medium text-muted-foreground block mb-1.5">
                <BookOpen className="h-2.5 w-2.5 inline mr-1" />
                Recently Learned
              </span>
              <div className="space-y-1">
                {stats.recentFacts.slice(0, 3).map((fact, i) => (
                  <p key={i} className="text-[10px] text-foreground/80 line-clamp-2 leading-relaxed pl-2 border-l-2 border-primary/20">
                    {fact}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Full insights (loaded on demand) */}
          {loadingInsights && (
            <div className="px-3 py-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[10px]">Reflecting on your legal research history...</span>
            </div>
          )}

          {insights && (
            <div className="px-3 py-2.5">
              <span className="text-[10px] font-medium text-muted-foreground block mb-1.5">
                <Sparkles className="h-2.5 w-2.5 inline mr-1" />
                AI Memory Insights
              </span>
              <div className="text-[10px] text-foreground/80 leading-relaxed whitespace-pre-line bg-muted/20 rounded-lg p-2.5 max-h-[200px] overflow-y-auto">
                {insights.insights}
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-[10px] text-red-500">
              {error}
            </div>
          )}

          {/* Powered by Hindsight badge */}
          <div className="px-3 py-1.5 bg-muted/10 border-t border-border/30 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">
              Powered by Hindsight™ Memory
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[9px] gap-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleExpand}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
 
