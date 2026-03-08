import OpenAI from 'openai'
import { getPrompts, type UseCase } from './prompts'
import { AI_MODELS, AI_TOKENS, AI_TEMPERATURES } from './config'

// Singleton OpenAI client
let openaiClient: OpenAI | null = null

function getClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not configured')
        }
        openaiClient = new OpenAI({ apiKey })
    }
    return openaiClient
}

// Truncate input text defensively
export function truncateText(text: string, maxChars: number = 4000): string {
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars) + '\n\n[... text truncated for processing ...]'
}

// Central AI gateway — ALL OpenAI calls go through here
export async function callAI(
    useCase: UseCase,
    input: Record<string, unknown>,
    options?: {
        jsonMode?: boolean
        conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
        model?: string
        maxTokens?: number
        projectId?: string
        useRAG?: boolean
    }
): Promise<{ result: string; tokensUsed: number }> {
    const client = getClient()
    const { systemPrompt, userPrompt } = getPrompts(useCase, input)

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt }
    ]

    // Inject RAG context if requested
    if (options?.useRAG && options?.projectId) {
        try {
            const { retrieveRelevantChunks, buildRAGContext, RAG_GROUNDING_INSTRUCTION } = await import('@/lib/rag')
            const { retrieveProjectAnalysis, retrieveClauses } = await import('@/lib/document-intelligence')

            // Parallel retrieval of all intelligence layers
            const [retrieval, summaries, clauses, memories, graphContext, conflictsCtx, insightsCtx, projectSummaryCtx] = await Promise.all([
                retrieveRelevantChunks(options.projectId, String(input.text || input.message || '')),
                retrieveProjectAnalysis(options.projectId),
                retrieveClauses(options.projectId),
                import('@/lib/memory').then(m => m.retrieveProjectMemory(options.projectId!, String(input.text || input.message || ''))),
                import('@/lib/graph').then(g => g.retrieveGraphContext(options.projectId!)),
                import('@/lib/trust').then(t => t.retrieveConflicts(options.projectId!)),
                import('@/lib/trust').then(t => t.retrieveInsights(options.projectId!)),
                import('@/lib/trust').then(t => t.retrieveProjectSummary(options.projectId!))
            ])

            if (retrieval.chunks.length > 0 || summaries.length > 0 || clauses.length > 0 || memories.length > 0 || graphContext || conflictsCtx || insightsCtx || projectSummaryCtx) {
                let contextMessage = ''

                // 1. Project Summary (Matter Overview)
                if (projectSummaryCtx) {
                    contextMessage += 'MATTER OVERVIEW:\n'
                    contextMessage += projectSummaryCtx
                    contextMessage += '\n\n'
                }

                // 2. Conflicts (Cross-Document Contradictions)
                if (conflictsCtx) {
                    contextMessage += 'CROSS-DOCUMENT CONFLICTS:\n'
                    contextMessage += conflictsCtx
                    contextMessage += '\n\n'
                }

                // 3. Vault Insights (Aggregated Intelligence)
                if (insightsCtx) {
                    contextMessage += 'VAULT INSIGHTS:\n'
                    contextMessage += insightsCtx
                    contextMessage += '\n\n'
                }

                // 4. Knowledge Graph (Entity Relationships)
                if (graphContext) {
                    contextMessage += 'KNOWLEDGE GRAPH:\n'
                    contextMessage += graphContext
                    contextMessage += '\n'
                }

                // 5. Project Memory (Facts, Decisions)
                if (memories.length > 0) {
                    contextMessage += 'PROJECT KNOWLEDGE (Facts, Decisions, Insights):\n'
                    contextMessage += memories.map(m => `- [${m.memory_type.toUpperCase()}] ${m.content}`).join('\n')
                    contextMessage += '\n\n'
                }

                // 6. Document Summaries
                if (summaries.length > 0) {
                    contextMessage += 'DOCUMENT SUMMARIES:\n'
                    contextMessage += summaries.map(s => `- ${s.summary}`).join('\n')
                    contextMessage += '\n\n'
                }

                // 7. Key Legal Clauses (up to 8)
                if (clauses.length > 0) {
                    contextMessage += 'KEY LEGAL CLAUSES:\n'
                    contextMessage += clauses.slice(0, 8).map(c => `- [${c.clauseType}] ${c.sectionTitle || ''}: ${truncateText(c.content, 300)}`).join('\n')
                    contextMessage += '\n\n'
                }

                // 8. RAG Chunks (Detailed Excerpts)
                if (retrieval.chunks.length > 0) {
                    const ragContext = buildRAGContext(retrieval.chunks)
                    contextMessage += `DETAILED EXCERPTS:\n---\n${ragContext}\n---`
                }

                messages[0] = { role: 'system', content: RAG_GROUNDING_INSTRUCTION }
                messages.push({
                    role: 'system',
                    content: `PROJECT INTELLIGENCE CONTEXT:\n${contextMessage}`
                })
            }
        } catch (ragError) {
            console.error('[AI] Context injection failed, continuing:', ragError)
        }
    }

    // Add capped conversation history if provided (max last 6 messages)
    if (options?.conversationHistory) {
        const capped = options.conversationHistory.slice(-6)
        for (const msg of capped) {
            messages.push({ role: msg.role, content: truncateText(msg.content, 500) })
        }
    }

    messages.push({ role: 'user', content: userPrompt })

    const startTime = Date.now()

    const completion = await client.chat.completions.create({
        model: options?.model || AI_MODELS.chat,
        messages,
        max_tokens: options?.maxTokens || AI_TOKENS.default,
        temperature: AI_TEMPERATURES.default,
        ...(options?.jsonMode ? { response_format: { type: 'json_object' as const } } : {})
    })

    const tokensUsed = completion.usage?.total_tokens || 0
    const duration = Date.now() - startTime

    // Log usage (console + structured)
    console.log(`[AI] use_case=${useCase} | tokens=${tokensUsed} | prompt_tokens=${completion.usage?.prompt_tokens || 0} | completion_tokens=${completion.usage?.completion_tokens || 0} | duration=${duration}ms${options?.useRAG ? ' | rag=true' : ''}`)

    import('@/lib/logger').then(({ logEvent }) => {
        logEvent('AI_CALL', {
            useCase,
            model: options?.model || AI_MODELS.chat,
            tokensIn: completion.usage?.prompt_tokens || 0,
            tokensOut: completion.usage?.completion_tokens || 0,
            tokensTotal: tokensUsed,
            latencyMs: duration,
            jsonMode: !!options?.jsonMode,
            ragEnabled: !!options?.useRAG,
            success: true
        }, options?.projectId)
    }).catch(() => { })

    const result = completion.choices[0]?.message?.content || ''

    return { result, tokensUsed }
}

// Safe wrapper that catches errors and returns user-friendly messages
export async function callAISafe(
    useCase: UseCase,
    input: Record<string, unknown>,
    options?: {
        jsonMode?: boolean
        conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
        model?: string
        maxTokens?: number
        projectId?: string
        useRAG?: boolean
    }
): Promise<{ result: string; tokensUsed: number; error?: string }> {
    try {
        return await callAI(useCase, input, options)
    } catch (error: unknown) {
        let message = error instanceof Error ? error.message : 'Unknown error'

        // Mask specific provider names in logs and error displays
        message = message.replace(/openai/gi, 'Wesley')

        console.error(`[AI ERROR] use_case=${useCase} | error=${message}`)

        import('@/lib/logger').then(({ logEvent }) => {
            logEvent('AI_CALL', {
                useCase,
                error: message,
                success: false
            }, options?.projectId)
        }).catch(() => { })

        if (message.includes('API key') || message.includes('api_key') || message.includes('apiKey')) {
            return { result: '', tokensUsed: 0, error: 'AI processing engine is not configured. Please set the required configuration or contact support.' }
        }
        if (message.includes('rate_limit') || message.includes('429')) {
            return { result: '', tokensUsed: 0, error: 'AI processing engine is temporarily busy. Please try again in a moment.' }
        }
        if (message.includes('insufficient_quota')) {
            return { result: '', tokensUsed: 0, error: 'AI processing engine quota exceeded. Please try again later.' }
        }

        return { result: '', tokensUsed: 0, error: 'AI processing engine failed. Please try again.' }
    }
}
