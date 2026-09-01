"use client"

import * as React from "react"
import { Globe, ExternalLink, Play, Loader2, CheckCircle2, Scale, BookOpen, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────────────

export interface WebResearchSource {
  title: string
  citation: string
  snippet: string
  url: string
  source: string
  date?: string
}

export interface WebResearchStatus {
  isResearching: boolean
  phase: 'idle' | 'launching' | 'searching' | 'extracting' | 'complete' | 'error'
  sources: WebResearchSource[]
  sessionId?: string
  searchedDatabases: string[]
  durationMs?: number
  error?: string
}

// ─── Source Icons ────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; color: string }> = {
  google_scholar: { label: 'Google Scholar', color: 'text-blue-500' },
  cornell_lii: { label: 'Cornell LII', color: 'text-red-500' },
  justia: { label: 'Justia', color: 'text-amber-500' },
  web: { label: 'Web', color: 'text-emerald-500' },
}

// ─── Phase Messages ──────────────────────────────────────────────

const PHASE_MESSAGES: Record<string, string> = {
  launching: 'Launching stealth browser...',
  searching: 'Searching legal databases...',
  extracting: 'Extracting case law & statutes...',
  complete: 'Research complete',
  error: 'Research failed',
}

// ─── Component ───────────────────────────────────────────────────

interface WebResearchPanelProps {
  status: WebResearchStatus
  className?: string
}

export function WebResearchPanel({ status, className = '' }: WebResearchPanelProps) {
  if (status.phase === 'idle') return null

  const isActive = status.isResearching
  const isDone = status.phase === 'complete'
  const hasError = status.phase === 'error'

  return (
    <div className={`rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/40 bg-muted/20 flex items-center gap-2">
        <div className={`p-1 rounded-md ${isDone ? 'bg-emerald-500/10' : hasError ? 'bg-red-500/10' : 'bg-primary/10'}`}>
          {isActive ? (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Globe className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
        <span className="text-[11px] font-semibold text-foreground">
          {PHASE_MESSAGES[status.phase] || 'Web Research'}
        </span>
        {isDone && status.durationMs && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {(status.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Searched databases */}
      {status.searchedDatabases.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border/30">
          {status.searchedDatabases.map((db) => (
            <span
              key={db}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground"
            >
              <Search className="h-2.5 w-2.5" />
              {db}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      {status.sources.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto">
          {status.sources.map((source, i) => {
            const meta = SOURCE_META[source.source] || SOURCE_META.web
            return (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors border-b border-border/20 last:border-0 group"
              >
                <div className={`mt-0.5 ${meta.color}`}>
                  <Scale className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground truncate">
                      {source.title}
                    </span>
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  {source.citation && source.citation !== source.title && (
                    <span className="text-[10px] text-primary/70 block truncate">
                      {source.citation}
                    </span>
                  )}
                  {source.snippet && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {source.snippet}
                    </p>
                  )}
                </div>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${meta.color} bg-muted/40`}>
                  {meta.label}
                </span>
              </a>
            )
          })}
        </div>
      )}

      {/* Session Recording */}
      {isDone && status.sessionId && (
        <div className="px-3 py-2 border-t border-border/40 bg-muted/10 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Session recorded for audit trail
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 text-primary"
            onClick={() => window.open(`/api/research/replay/${status.sessionId}`, '_blank')}
          >
            <Play className="h-2.5 w-2.5" />
            Watch Replay
          </Button>
        </div>
      )}

      {/* Error */}
      {hasError && status.error && (
        <div className="px-3 py-2 text-[10px] text-red-500 bg-red-500/5">
          {status.error}
        </div>
      )}
    </div>
  )
}
