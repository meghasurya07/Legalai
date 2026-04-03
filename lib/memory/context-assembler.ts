/**
 * Memory Context Assembler — Formats retrieved memories for prompt injection
 *
 * Enforces the MEMORY_TOKEN_BUDGET (~3000 tokens).
 * Structures output into sections: PROJECT KNOWLEDGE / FIRM INTELLIGENCE / YOUR PREFERENCES.
 * Includes memory attribution for traceability.
 */

import type {
    MemoryRetrievalResult,
    FirmPatternItem,
    MemoryContext,
} from './types'
import { MEMORY_TOKEN_BUDGET } from './types'

/** Approximate token count (4 chars ≈ 1 token) */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

/** Format a single memory for prompt inclusion */
function formatMemory(mem: MemoryRetrievalResult, index: number): string {
    const sourceLabel = mem.source === 'chat' ? 'conversation'
        : mem.source === 'document' ? 'document'
        : mem.source === 'manual' ? 'user-added'
        : mem.source

    const confidenceIcon = mem.confidence > 0.8 ? '✓' : '~'

    return `  [${index}] ${mem.content} [${confidenceIcon} ${sourceLabel}, ${mem.memory_type}]`
}

/** Format a firm pattern for prompt inclusion */
function formatFirmPattern(pattern: FirmPatternItem, index: number): string {
    return `  [F${index}] ${pattern.title}: ${pattern.description} (confidence: ${(pattern.confidence * 100).toFixed(0)}%, based on ${pattern.evidence_count} cases)`
}

/**
 * Assemble memory context for prompt injection.
 * Prioritizes: pinned > project memories > user preferences > firm patterns.
 * Hard-capped at MEMORY_TOKEN_BUDGET tokens.
 */
export function assembleMemoryContext(
    projectMemories: MemoryRetrievalResult[],
    firmPatterns: FirmPatternItem[],
    userPreferences: MemoryRetrievalResult[]
): MemoryContext {
    const sections: string[] = []
    let totalTokens = 0

    // Header
    const header = `\n--- PROJECT KNOWLEDGE (retrieved from memory) ---`
    totalTokens += estimateTokens(header)

    // 1. Project memories (highest priority)
    const projectSection: string[] = []
    let memIndex = 1
    for (const mem of projectMemories) {
        const line = formatMemory(mem, memIndex)
        const lineTokens = estimateTokens(line)

        if (totalTokens + lineTokens > MEMORY_TOKEN_BUDGET * 0.7) break // Reserve 30% for prefs + firm
        projectSection.push(line)
        totalTokens += lineTokens
        memIndex++
    }

    if (projectSection.length > 0) {
        sections.push(header)
        sections.push(projectSection.join('\n'))
    }

    // 2. User preferences
    if (userPreferences.length > 0) {
        const prefHeader = `\n--- YOUR PREFERENCES ---`
        totalTokens += estimateTokens(prefHeader)

        const prefSection: string[] = []
        for (const pref of userPreferences) {
            const line = formatMemory(pref, memIndex)
            const lineTokens = estimateTokens(line)

            if (totalTokens + lineTokens > MEMORY_TOKEN_BUDGET * 0.9) break // Reserve 10% for firm
            prefSection.push(line)
            totalTokens += lineTokens
            memIndex++
        }

        if (prefSection.length > 0) {
            sections.push(prefHeader)
            sections.push(prefSection.join('\n'))
        }
    }

    // 3. Firm intelligence (lowest priority, budget remaining)
    if (firmPatterns.length > 0) {
        const firmHeader = `\n--- FIRM INTELLIGENCE ---`
        totalTokens += estimateTokens(firmHeader)

        const firmSection: string[] = []
        let firmIndex = 1
        for (const pattern of firmPatterns) {
            const line = formatFirmPattern(pattern, firmIndex)
            const lineTokens = estimateTokens(line)

            if (totalTokens + lineTokens > MEMORY_TOKEN_BUDGET) break
            firmSection.push(line)
            totalTokens += lineTokens
            firmIndex++
        }

        if (firmSection.length > 0) {
            sections.push(firmHeader)
            sections.push(firmSection.join('\n'))
        }
    }

    // Attribution footer
    if (sections.length > 0) {
        const footer = `\n--- END MEMORY CONTEXT ---`
        sections.push(footer)
        totalTokens += estimateTokens(footer)
    }

    const formattedText = sections.join('\n')

    return {
        project_memories: projectMemories.slice(0, memIndex - 1),
        firm_patterns: firmPatterns,
        user_preferences: userPreferences,
        total_tokens: totalTokens,
        formatted_text: formattedText,
    }
}

/**
 * Build the memory attribution instruction string for the system prompt.
 * Tells the AI how to reference retrieved memories in its response.
 */
export function buildMemoryAttribution(): string {
    return `
**MEMORY ATTRIBUTION INSTRUCTIONS:**
You have been provided with PROJECT KNOWLEDGE, PREFERENCES, and FIRM INTELLIGENCE above. When referencing this information in your response:
- When citing a project fact, use natural language like "As previously identified..." or "Based on established case facts..."
- When using a user preference, adapt your response style accordingly without explicitly mentioning it.
- When citing firm intelligence, frame as "Based on firm experience..." or "Your organization's historical patterns suggest..."
- NEVER fabricate memory references. Only cite information that was actually provided in the memory context above.
- If the memory context conflicts with the user's current question, prioritize the user's explicit request but note the discrepancy.`
}
