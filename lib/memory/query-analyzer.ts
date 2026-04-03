/**
 * Memory Query Analyzer — Intent classification for retrieval routing
 *
 * Classifies incoming queries to determine optimal retrieval strategy.
 * Uses lightweight AI call (~100ms) or heuristic fallback.
 */

import { callAI } from '@/lib/ai/client'
import { parseAIJSON } from '@/lib/api-utils'
import type { QueryAnalysis, QueryIntent, MemoryType } from './types'

/** Fast heuristic classification — no AI call needed for common patterns */
function classifyByHeuristic(query: string): QueryAnalysis | null {
    const lower = query.toLowerCase()

    // Preference check
    if (lower.includes('my preference') || lower.includes('i prefer') || lower.includes('how do i like')) {
        return {
            intent: 'preference_check',
            entities: [],
            temporal_scope: 'all',
            retrieval_scope: 'project_only',
            memory_types: ['preference', 'correction'],
        }
    }

    // Cross-case patterns
    if (lower.includes('across cases') || lower.includes('other matters') ||
        lower.includes('similar case') || lower.includes('firm pattern') ||
        lower.includes('how have we')) {
        return {
            intent: 'cross_case',
            entities: [],
            temporal_scope: 'all',
            retrieval_scope: 'firm_wide',
            memory_types: ['pattern', 'argument', 'outcome'],
        }
    }

    // Drafting intent
    if (lower.includes('draft') || lower.includes('write') || lower.includes('compose') ||
        lower.includes('template') || lower.includes('prepare')) {
        return {
            intent: 'drafting',
            entities: [],
            temporal_scope: 'all',
            retrieval_scope: 'project_only',
            memory_types: ['fact', 'decision', 'obligation', 'preference', 'procedure'],
        }
    }

    return null // Fall through to AI classification
}

/**
 * Analyze a query to determine retrieval strategy.
 * Returns intent, entity mentions, temporal scope, and target memory types.
 */
export async function analyzeQuery(query: string): Promise<QueryAnalysis> {
    // 1. Try heuristic first (free, instant)
    const heuristic = classifyByHeuristic(query)
    if (heuristic) return heuristic

    // 2. Default classification for short/simple queries
    if (query.length < 30) {
        return {
            intent: 'factual_lookup',
            entities: [],
            temporal_scope: 'recent',
            retrieval_scope: 'project_only',
            memory_types: ['fact', 'decision', 'risk', 'obligation', 'insight'],
        }
    }

    // 3. AI classification for complex queries
    try {
        const { result } = await callAI('memory_extraction', {
            text: `Classify this legal query for memory retrieval:
Query: "${query}"

Return JSON:
{
  "intent": "factual_lookup|analysis|drafting|comparison|cross_case|preference_check",
  "entities": ["entity names mentioned"],
  "temporal_scope": "recent|historical|all",
  "retrieval_scope": "project_only|cross_case|firm_wide",
  "memory_types": ["fact","decision","risk","obligation","insight","preference","argument","outcome","procedure","pattern","correction"]
}

Rules:
- intent: factual_lookup for specific questions, analysis for deep reasoning, drafting for document creation, comparison for contrasting, cross_case for multi-project queries
- entities: extract any party names, case names, jurisdictions, statute names
- temporal_scope: "recent" if about current status, "historical" for past events, "all" otherwise
- retrieval_scope: "project_only" default, "cross_case" if comparing cases, "firm_wide" if asking about firm patterns
- memory_types: list only the relevant types for this query (not all types)`,
        }, { jsonMode: true })

        const parsed = parseAIJSON(result, undefined)
        if (parsed && parsed.intent) {
            return {
                intent: (parsed.intent as QueryIntent) || 'factual_lookup',
                entities: Array.isArray(parsed.entities) ? parsed.entities : [],
                temporal_scope: parsed.temporal_scope || 'all',
                retrieval_scope: parsed.retrieval_scope || 'project_only',
                memory_types: Array.isArray(parsed.memory_types)
                    ? parsed.memory_types as MemoryType[]
                    : ['fact', 'decision', 'risk', 'obligation', 'insight'],
            }
        }
    } catch {
        // AI classification failure — use safe default
    }

    // 4. Safe default
    return {
        intent: 'factual_lookup',
        entities: [],
        temporal_scope: 'all',
        retrieval_scope: 'project_only',
        memory_types: ['fact', 'decision', 'risk', 'obligation', 'insight'],
    }
}
