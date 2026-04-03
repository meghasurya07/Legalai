/**
 * Session Summarizer — End-of-Conversation Summary Generator
 *
 * Triggered when a conversation reaches 5+ turns.
 * Generates a structured summary: key topics, decisions, open questions.
 * Promotes important facts from the session to project-level memory (Layer 2).
 */

import { callAI } from '@/lib/ai/client'
import { addMemory } from './manager'
import { detectAndPersistPreferences } from './preference-detector'
import type { MemoryType } from './types'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface SessionMessage {
    role: 'user' | 'assistant'
    content: string
}

interface SessionSummary {
    topics: string[]
    decisions: string[]
    openQuestions: string[]
    keyFacts: string[]
    risksIdentified: string[]
    nextSteps: string[]
}

interface SummarizeParams {
    projectId: string
    organizationId?: string
    userId: string
    conversationId: string
    messages: SessionMessage[]
}

// ═══════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════

/**
 * Summarize a conversation session and promote key findings to Layer 2 memory.
 * Only triggers for conversations with 5+ turns.
 */
export async function summarizeSession(params: SummarizeParams): Promise<{
    summary: SessionSummary | null
    memoriesCreated: number
    preferencesDetected: number
}> {
    const { projectId, organizationId, userId, conversationId, messages } = params

    // Only summarize substantive conversations
    if (messages.length < 10) { // 5 user + 5 assistant messages
        return { summary: null, memoriesCreated: 0, preferencesDetected: 0 }
    }

    // 1. Generate structured summary via AI
    const summary = await generateSummary(messages)
    if (!summary) {
        return { summary: null, memoriesCreated: 0, preferencesDetected: 0 }
    }

    // 2. Promote key findings to Layer 2 memory
    let memoriesCreated = 0

    // Promote decisions
    for (const decision of summary.decisions) {
        const result = await promoteToMemory({
            projectId,
            organizationId,
            userId,
            conversationId,
            content: decision,
            type: 'decision',
            importance: 4,
        })
        if (result) memoriesCreated++
    }

    // Promote key facts
    for (const fact of summary.keyFacts) {
        const result = await promoteToMemory({
            projectId,
            organizationId,
            userId,
            conversationId,
            content: fact,
            type: 'fact',
            importance: 3,
        })
        if (result) memoriesCreated++
    }

    // Promote risks
    for (const risk of summary.risksIdentified) {
        const result = await promoteToMemory({
            projectId,
            organizationId,
            userId,
            conversationId,
            content: risk,
            type: 'risk',
            importance: 4,
        })
        if (result) memoriesCreated++
    }

    // 3. Detect user preferences from the conversation
    const userMessages = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)

    const preferencesDetected = await detectAndPersistPreferences({
        userId,
        organizationId,
        projectId,
        messages: userMessages,
    })

    return { summary, memoriesCreated, preferencesDetected }
}

// ═══════════════════════════════════════════════════
// AI SUMMARY GENERATION
// ═══════════════════════════════════════════════════

async function generateSummary(messages: SessionMessage[]): Promise<SessionSummary | null> {
    // Truncate conversation to fit within token limits
    const transcript = messages
        .slice(-20) // Last 20 messages max
        .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`)
        .join('\n\n')

    try {
        const { result } = await callAI('session_summary' as Parameters<typeof callAI>[0], {
            conversation: transcript,
        }, {
            jsonMode: true,
            maxTokens: 1000,
        })

        const parsed = JSON.parse(result)

        return {
            topics: Array.isArray(parsed.topics) ? parsed.topics : [],
            decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
            openQuestions: Array.isArray(parsed.open_questions) ? parsed.open_questions : [],
            keyFacts: Array.isArray(parsed.key_facts) ? parsed.key_facts : [],
            risksIdentified: Array.isArray(parsed.risks) ? parsed.risks : [],
            nextSteps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
        }
    } catch (err) {
        console.warn('[Session Summarizer] Summary generation failed:', err)
        return null
    }
}

// ═══════════════════════════════════════════════════
// MEMORY PROMOTION
// ═══════════════════════════════════════════════════

async function promoteToMemory(params: {
    projectId: string
    organizationId?: string
    userId: string
    conversationId: string
    content: string
    type: MemoryType
    importance: number
}): Promise<boolean> {
    const result = await addMemory({
        projectId: params.projectId,
        organizationId: params.organizationId,
        userId: params.userId,
        content: params.content,
        type: params.type,
        source: 'chat',
        sourceId: params.conversationId,
        importance: params.importance,
        confidence: 0.75, // Session-derived memories start at moderate confidence
        authorityWeight: 0.7,
        metadata: {
            promoted_from: 'session_summary',
            conversation_id: params.conversationId,
        },
    })

    return result !== null && result !== 'duplicate'
}
