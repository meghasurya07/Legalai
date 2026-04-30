import { NextRequest } from 'next/server'
import { getPrompts } from '@/lib/ai/prompts'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { getChatConfig, type ChatMode } from '@/lib/ai/config'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'
import { phaseEvent } from '@/lib/ai/citation-extractor'
import { buildChatContext } from '@/lib/ai/context-builder'
import { getImageInputsFromFiles, prepareFilesForTextContext } from '@/lib/ai/chat-file-inputs'
import { streamResponsesAPI } from '@/lib/ai/stream-responses'
import { streamChatCompletions } from '@/lib/ai/stream-completions'

export async function POST(request: NextRequest) {
    try {
        let body
        try {
            body = await request.json()
        } catch {
            return apiError('Invalid JSON in request body', 400)
        }
        const { sanitizeText, validateUUID } = await import('@/lib/validation')
        const message = sanitizeText(body.message, 100000)
        const { customization, files, queryMode, webSearch, thinking, deepResearch, confidenceMode } = body
        const attachedFiles = Array.isArray(files) ? files : []
        const effectiveMessage = message || (attachedFiles.length > 0 ? 'Please analyze the attached image(s).' : '')
        const projectId = validateUUID(body.projectId)
        const conversationId = validateUUID(body.conversationId)

        if (!effectiveMessage) {
            return apiError('Message is required', 400)
        }

        // Require authentication
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        // Rate limit chat messages
        const { checkRateLimit, RATE_LIMIT_CHAT } = await import('@/lib/rate-limit')
        const { allowed } = checkRateLimit(`chat:${userId}`, RATE_LIMIT_CHAT)
        if (!allowed) {
            return apiError('Too many messages. Please slow down.', 429)
        }

        // Rate limit for deep research: 5 per month per user
        if (deepResearch) {
            const { data: userSettings } = await supabase
                .from('user_settings')
                .select('deep_research_count, deep_research_reset_date')
                .eq('user_id', userId)
                .single()

            const now = new Date()
            let count = userSettings?.deep_research_count || 0
            let resetDate = userSettings?.deep_research_reset_date ? new Date(userSettings.deep_research_reset_date) : now

            if (now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
                count = 0
                resetDate = now
            }

            if (count >= 5) {
                return apiError('Deep Research monthly limit reached (5/5). Please try again next month.', 429)
            }

            await supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    deep_research_count: count + 1,
                    deep_research_reset_date: resetDate.toISOString()
                })
        }

        // ─── Fetch Conversation History ─────────────────────────────
        let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
        if (conversationId) {
            const { data: historyRows } = await supabase
                .from('messages')
                .select('role, content')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(40) // Last 40 messages (20 turns)

            if (historyRows && historyRows.length > 0) {
                conversationHistory = historyRows
                    .filter((m: { role: string; content: string }) => m.role === 'user' || m.role === 'assistant')
                    .map((m: { role: string; content: string }) => ({
                        role: m.role as 'user' | 'assistant',
                        // Strip hidden markers from assistant messages to save tokens
                        content: m.content
                            .replace(/<!--CALENDAR_ACTION:[\s\S]*?-->/g, '')
                            .replace(/<!--SOURCES:[\s\S]*?-->/g, '')
                            .replace(/<!--DRAFT_START:[\s\S]*?-->/g, '')
                            .replace(/<!--DRAFT_END-->/g, '')
                            .trim()
                    }))
                    .filter((m: { content: string }) => m.content.length > 0)
            }
        }

        // ─── Build Chat Context (RAG + Memory + Files) ───────────────
        const imageInputs = getImageInputsFromFiles(attachedFiles)
        const ctx = await buildChatContext(effectiveMessage, projectId, userId, prepareFilesForTextContext(attachedFiles))
        const { userContent, ragSourcesBlock } = ctx
        const { ragContext, ragSystemMessage, ragChunks, memoryContextText, memoryAttributionText, usedMemories } = ctx

        // Determine chat mode
        const chatMode: ChatMode = deepResearch ? 'deepResearch' : thinking ? 'thinking' : webSearch ? 'webSearch' : 'standard'
        const { model } = getChatConfig(chatMode)

        // Resolve OpenAI client (BYOK or system key)
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const orgCtx = await getOrgContext()
            orgId = orgCtx?.orgId
        } catch {
            // No org context — use system key
        }

        const { resolveOpenAIClient } = await import('@/lib/byok')
        const client = await resolveOpenAIClient(orgId, { timeout: deepResearch ? 3600 * 1000 : undefined })
        const encoder = new TextEncoder()
        const streamStartTime = Date.now()

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    const sourcesBlock = ragSourcesBlock

                    // Build the system prompt and user prompt
                    const { systemPrompt, userPrompt } = getPrompts('assistant_chat', {
                        message: userContent,
                        customization,
                        queryMode,
                        webSearch,
                        thinking,
                        deepResearch,
                        hasRagContext: !!ragContext
                    })

                    const fullSystemPrompt = [
                        systemPrompt,
                        ragSystemMessage ? ragSystemMessage : '',
                        memoryContextText ? memoryContextText : '',
                        memoryAttributionText ? memoryAttributionText : ''
                    ].filter(Boolean).join('\n\n')

                    // Move RAG context into user prompt for better citation adherence
                    let finalUserPrompt = ragContext
                        ? `REFERENCED DOCUMENT EXCERPTS:\n\n${ragContext}\n\n---\n\nUser question: ${userPrompt}\n\nCRITICAL: You MUST include [1], [2], [3] citation numbers inline after EVERY factual sentence. Example: "The agreement was signed on Feb 11, 2013 [1]."`
                        : userPrompt

                    if (webSearch || deepResearch) {
                        finalUserPrompt += `\n\n[CRITICAL INSTRUCTION: You MUST actively use the web_search tool to gather the most accurate, up-to-date, and comprehensive information before answering. Do NOT rely solely on your internal training data, even if you think you know the answer.]`
                    }

                    if (confidenceMode) {
                        const sourceDesc = (webSearch || deepResearch) ? "the search results provided by the search tool" : "the provided document context"
                        finalUserPrompt += `\n\n[CONFIDENCE MODE ACTIVATED]\nCRITICAL: You MUST actively evaluate the verifyability of your statements based ONLY on ${sourceDesc}.\nFor EVERY factual claim you make, you MUST append a confidence badge directly after the sentence.\nUse one of these exactly: [CONF_HIGH], [CONF_MEDIUM], or [CONF_LOW].\n\n- Use [CONF_HIGH] if the claim is explicitly stated in the context/results.\n- Use [CONF_MEDIUM] if the claim is implied or synthesized from vague parts of the context/results.\n- Use [CONF_LOW] if you cannot find direct support in the context/results (hallucination risk).\n\nIf you are also using [1] citations, put the confidence badge immediately before or after the citation. Example: "The cap is $5M [1] [CONF_HIGH]."`

                        if (!ragContext && !webSearch && !deepResearch) {
                            finalUserPrompt += `\n\nNOTE: You were not provided with any document context or search results for this query. Therefore, ANY factual claims you make about specific documents, people, or entities MUST be marked as [CONF_LOW].`
                        }
                    }

                    // ═══════════════════════════════════════════════
                    // Route to the appropriate streaming strategy
                    // ═══════════════════════════════════════════════
                    const sharedParams = {
                        controller, encoder, client, model, fullSystemPrompt, finalUserPrompt,
                        ragChunks, sourcesBlock, imageInputs,
                        conversationId, projectId, orgId, userId, usedMemories,
                        conversationHistory,
                        streamStartTime,
                    }

                    if (webSearch || thinking || deepResearch) {
                        await streamResponsesAPI({
                            ...sharedParams,
                            webSearch, thinking, deepResearch, chatMode,
                        })
                    } else {
                        await streamChatCompletions(sharedParams)
                    }
                } catch (err) {
                    logger.error('chat/route', 'Stream error', err)
                    try {
                        controller.enqueue(encoder.encode(phaseEvent('error', 'error', 'Something went wrong while processing')))
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                        controller.close()
                    } catch {
                        // Controller already closed (client disconnected)
                    }
                }
            }
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    } catch (error) {
        return apiError('Internal server error', 500, error)
    }
}
