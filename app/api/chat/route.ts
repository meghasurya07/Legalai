import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getPrompts } from '@/lib/ai/prompts'
import { searchMultiple, formatSearchResultsAsContext, buildSourcesBlock } from '@/lib/ai/search'
import { supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { retrieveRelevantChunks, buildRAGContext, buildRAGSourcesBlock, RAG_GROUNDING_INSTRUCTION } from '@/lib/rag'

// Helper to emit SSE phase events
function phaseEvent(phase: string, status: string, detail?: string, meta?: Record<string, unknown>) {
    return `event: phase\ndata: ${JSON.stringify({ phase, status, detail, ...meta })}\n\n`
}

interface AttachedFile {
    name: string
    content?: string
    [key: string]: unknown
}

export async function POST(request: NextRequest) {
    try {
        const { message, customization, files, queryMode, webSearch, thinking, deepResearch, projectId, conversationId } = await request.json()

        let userContent = message || ''
        let ragContext = ''
        let ragSystemMessage = ''
        let ragSourcesBlock = ''

        // 1. RAG Context Injection from Project Documents
        if (projectId) {
            try {
                const retrieval = await retrieveRelevantChunks(projectId, userContent)
                if (retrieval.chunks.length > 0) {
                    ragContext = buildRAGContext(retrieval.chunks)
                    ragSystemMessage = RAG_GROUNDING_INSTRUCTION
                    ragSourcesBlock = buildRAGSourcesBlock(retrieval.chunks)
                } else {
                    // Fallback: if no chunks exist (e.g. migration not run yet), use legacy approach
                    const { data: projectFiles } = await supabase
                        .from('files')
                        .select('name, extracted_text')
                        .eq('project_id', projectId)
                        .not('extracted_text', 'is', null)

                    if (projectFiles && projectFiles.length > 0) {
                        userContent += `\n\n--- PROJECT CONTEXT (${projectFiles.length} files) ---\n`
                        projectFiles.forEach(f => {
                            const text = f.extracted_text?.slice(0, 20000) || ''
                            userContent += `\nFILE: ${f.name}\nCONTENT:\n${text}\n----------------\n`
                        })
                        userContent += `\n[INSTRUCTION: Use the above PROJECT CONTEXT to answer the user's query. Cite specific files if relevant.]`
                    }
                }
            } catch (ragError) {
                console.error('[RAG] Retrieval error, falling back to legacy:', ragError)
                // Fallback to legacy approach on error
                const { data: projectFiles } = await supabase
                    .from('files')
                    .select('name, extracted_text')
                    .eq('project_id', projectId)
                    .not('extracted_text', 'is', null)

                if (projectFiles && projectFiles.length > 0) {
                    userContent += `\n\n--- PROJECT CONTEXT (${projectFiles.length} files) ---\n`
                    projectFiles.forEach(f => {
                        const text = f.extracted_text?.slice(0, 20000) || ''
                        userContent += `\nFILE: ${f.name}\nCONTENT:\n${text}\n----------------\n`
                    })
                    userContent += `\n[INSTRUCTION: Use the above PROJECT CONTEXT to answer the user's query. Cite specific files if relevant.]`
                }
            }
        }

        if (files && files.length > 0) {
            const fileNames = files.map((f: AttachedFile) => typeof f === 'string' ? f : f.name).join(', ')
            userContent += `\n\n[User uploaded files in this message: ${fileNames}]`

            // Iterate through files and inject content if available
            files.forEach((f: AttachedFile) => {
                if (typeof f === 'object' && f.content) {
                    userContent += `\n--- FILE: ${f.name} ---\n${f.content.slice(0, 20000)}\n----------------\n`
                }
            })

            if (!message) {
                userContent += '\nPlease analyze these files.'
            }
        }

        // Determine model and token limits based on mode
        const model = 'gpt-4o-mini' // Default & requested cost-safe standard
        let maxTokens = 1500

        if (deepResearch) {
            maxTokens = 4000
        } else if (thinking) {
            maxTokens = 2000
        } else if (webSearch) {
            maxTokens = 1500
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return apiError('AI service is not configured', 503)
        }

        const client = new OpenAI({ apiKey })
        const encoder = new TextEncoder()

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    let searchContext = ''
                    let sourcesBlock = ragSourcesBlock
                    let thinkingPlan = ''

                    // ═══════════════════════════════════════════════
                    // DEEP RESEARCH — Real Pipeline V1
                    // ═══════════════════════════════════════════════
                    if (deepResearch) {
                        // Stage 1: Research Planning (Multi-Query Generation)
                        controller.enqueue(encoder.encode(phaseEvent('research_planning', 'start', 'Defining comprehensive research strategy')))

                        const queryGenResponse = await client.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: 'You are a legal research strategist. Generate 4 complementary, high-intent search queries to investigate this issue from multiple angles (statutory, case law, jurisdictional, and practical). Return ONLY a JSON array of strings.'
                                },
                                { role: 'user', content: userContent }
                            ],
                            max_tokens: 300,
                            temperature: 0.3
                        })

                        let searchQueries: string[] = [userContent]
                        try {
                            const raw = queryGenResponse.choices[0]?.message?.content || ''
                            const parsed = JSON.parse(raw)
                            if (Array.isArray(parsed)) searchQueries = parsed.slice(0, 4)
                        } catch { /* fallback to original */ }

                        controller.enqueue(encoder.encode(phaseEvent('research_planning', 'update', `Planned ${searchQueries.length} research vectors`, { queries: searchQueries })))

                        // Stage 2: Source Collection (Tavily Multi-Query)
                        controller.enqueue(encoder.encode(phaseEvent('source_collection', 'start', 'Retrieving authoritative legal sources using Tavily')))

                        const searchResponses = await searchMultiple(searchQueries, 5, 'advanced')
                        const totalResults = searchResponses.reduce((sum, r) => sum + r.results.length, 0)

                        const allDomains: string[] = []
                        for (const resp of searchResponses) {
                            for (const r of resp.results) {
                                try {
                                    const domain = new URL(r.url).hostname.replace('www.', '')
                                    if (!allDomains.includes(domain)) allDomains.push(domain)
                                } catch { /* skip */ }
                            }
                        }

                        controller.enqueue(encoder.encode(phaseEvent('source_collection', 'update', `Captured ${totalResults} sources from ${allDomains.length} domains`, { domains: allDomains, count: totalResults })))

                        // Stage 3: Reading & Extraction
                        controller.enqueue(encoder.encode(phaseEvent('reading_extraction', 'start', 'Extracting relevant passages and legal citations')))

                        searchContext = formatSearchResultsAsContext(searchResponses)
                        sourcesBlock = buildSourcesBlock(searchResponses)

                        controller.enqueue(encoder.encode(phaseEvent('reading_extraction', 'update', `Processed all found sources`)))

                        // Stage 4: Synthesis
                        controller.enqueue(encoder.encode(phaseEvent('synthesis', 'start', 'Synthesizing research into a coherent legal analysis')))

                        // Internal synthesis planning to ensure quality
                        const synthesisPlanResponse = await client.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: 'Analyze the following research and create a structured synthesis of the key findings. Resolve any conflicting information. Outline the core legal conclusions.'
                                },
                                { role: 'user', content: `Original Query: ${userContent}\n\nSearch context:\n${searchContext}` }
                            ],
                            max_tokens: 600,
                            temperature: 0.3
                        })

                        thinkingPlan = `SYNTHESIS PLAN:\n${synthesisPlanResponse.choices[0]?.message?.content || ''}`
                        controller.enqueue(encoder.encode(phaseEvent('synthesis', 'update', 'Organized research into key themes and precedents')))

                        // Stage 5: Drafting
                        controller.enqueue(encoder.encode(phaseEvent('drafting', 'start', 'Drafting final integrated legal answer')))

                        // ═══════════════════════════════════════════════
                        // WEB SEARCH — Real Pipeline V1
                        // ═══════════════════════════════════════════════
                    } else if (webSearch) {
                        controller.enqueue(encoder.encode(phaseEvent('research_planning', 'start', 'Optimizing search queries')))

                        const queryGenResponse = await client.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: 'Generate 2 complementary search queries for this topic. Return ONLY a JSON array of strings.'
                                },
                                { role: 'user', content: userContent }
                            ],
                            max_tokens: 200,
                            temperature: 0.3
                        })

                        let searchQueries: string[] = [userContent]
                        try {
                            const raw = queryGenResponse.choices[0]?.message?.content || ''
                            const parsed = JSON.parse(raw)
                            if (Array.isArray(parsed)) searchQueries = parsed.slice(0, 2)
                        } catch { /* fallback */ }

                        controller.enqueue(encoder.encode(phaseEvent('searching_web', 'start', 'Searching via Tavily')))

                        const searchResponses = await searchMultiple(searchQueries, 4, 'basic')
                        const totalResults = searchResponses.reduce((sum, r) => sum + r.results.length, 0)

                        const domains = [...new Set(searchResponses.flatMap(resp => resp.results.map(r => {
                            try { return new URL(r.url).hostname.replace('www.', '') } catch { return '' }
                        }).filter(Boolean)))]

                        controller.enqueue(encoder.encode(phaseEvent('searching_web', 'update', `Found ${totalResults} relevant sites`, { domains, count: totalResults })))

                        controller.enqueue(encoder.encode(phaseEvent('reading_sources', 'start', 'Reading source snippets')))
                        searchContext = formatSearchResultsAsContext(searchResponses)
                        sourcesBlock = buildSourcesBlock(searchResponses)
                        controller.enqueue(encoder.encode(phaseEvent('reading_sources', 'update', 'Extracted key information')))

                        controller.enqueue(encoder.encode(phaseEvent('drafting', 'start', 'Formulating answer')))

                        // ═══════════════════════════════════════════════
                        // THINKING — Real Pipeline V1
                        // ═══════════════════════════════════════════════
                    } else if (thinking) {
                        controller.enqueue(encoder.encode(phaseEvent('thinking', 'start', 'Analyzing complex reasoning paths')))

                        const planResponse = await client.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: `You are a legal reasoning agent. Break down this question into a logical reasoning chain. Consider conflicting views and jurisdictional nuances. Output a detailed internal plan (max 300 words).`
                                },
                                { role: 'user', content: userContent }
                            ],
                            max_tokens: 500,
                            temperature: 0.3
                        })

                        thinkingPlan = planResponse.choices[0]?.message?.content || ''

                        controller.enqueue(encoder.encode(phaseEvent('thinking', 'update', 'Constructed internal logic chain')))
                        controller.enqueue(encoder.encode(phaseEvent('drafting', 'start', 'Applying reasoning to final response')))

                    } else {
                        // Default
                        controller.enqueue(encoder.encode(phaseEvent('thinking', 'start', 'Analyzing query')))
                        controller.enqueue(encoder.encode(phaseEvent('drafting', 'start', 'Preparing response')))
                    }

                    // ═══════════════════════════════════════════════
                    // BUILD THE FINAL PROMPT & STREAM RESPONSE
                    // ═══════════════════════════════════════════════
                    const { systemPrompt, userPrompt } = getPrompts('assistant_chat', {
                        message: userContent,
                        customization,
                        queryMode,
                        webSearch,
                        thinking,
                        deepResearch
                    })

                    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                        {
                            role: 'system',
                            content: ragSystemMessage ? `${systemPrompt}\n\n${ragSystemMessage}` : systemPrompt
                        }
                    ]

                    // Inject RAG document context if available
                    if (ragContext) {
                        messages.push({
                            role: 'system',
                            content: `PROJECT DOCUMENTS:\n---\n${ragContext}\n---`
                        })
                    }

                    if (searchContext) {
                        messages.push({
                            role: 'system',
                            content: `Here are real web search results to base your answer on. Use these as your primary source of information and cite them using inline numbered citations [1], [2], etc.:\n\n${searchContext}`
                        })
                    }

                    if (thinkingPlan) {
                        messages.push({
                            role: 'system',
                            content: `Here is your internal analysis plan. Follow this structure to create a thorough response, but do NOT show this plan to the user:\n\n${thinkingPlan}`
                        })
                    }

                    messages.push({ role: 'user', content: userPrompt })

                    const stream = await client.chat.completions.create({
                        model,
                        messages,
                        max_tokens: maxTokens,
                        temperature: 0.4,
                        stream: true
                    })

                    let streamedContent = ''
                    let controllerClosed = false

                    const safeEnqueue = (data: Uint8Array) => {
                        if (controllerClosed) return false
                        try {
                            controller.enqueue(data)
                            return true
                        } catch {
                            controllerClosed = true
                            return false
                        }
                    }

                    for await (const chunk of stream) {
                        if (controllerClosed) break
                        const content = chunk.choices[0]?.delta?.content || ''
                        if (content) {
                            streamedContent += content
                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                        }
                    }

                    // If we have a backend-generated sources block (from Tavily or RAG),
                    // strip any AI-generated <!--SOURCES: block to prevent conflicts,
                    // then always append the real one.
                    if (sourcesBlock && !controllerClosed) {
                        // Strip AI-hallucinated sources from the streamed text - case insensitive and flexible whitespace
                        const aiSourcesRegex = /\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi
                        if (aiSourcesRegex.test(streamedContent)) {
                            streamedContent = streamedContent.replace(aiSourcesRegex, '').trim()
                        }
                        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: sourcesBlock })}\n\n`))
                    } else if (!sourcesBlock && !controllerClosed) {
                        // Normal mode: AI may have generated its own <!--SOURCES: block.
                        // Extract it from streamed content so we can send it cleanly.
                        const aiSourcesMatch = streamedContent.match(/\n*(<!--SOURCES:?\s*[\s\S]*?-->)/i)
                        if (aiSourcesMatch) {
                            const extractedSources = aiSourcesMatch[1]
                            // Strip the sources from the display and re-send clean content
                            const cleanContent = streamedContent.replace(/\n*<!--SOURCES:?\s*[\s\S]*?(-->|$)/gi, '').trim()
                            streamedContent = cleanContent
                            // Send the full clean content (overwrite what was streamed) + sources as a final chunk
                            // The frontend accumulates content, so we send a special marker to replace
                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n' + extractedSources })}\n\n`))
                        }
                    }

                    // Save assistant message to database if we have a conversationId
                    // This runs regardless of whether the stream was interrupted,
                    // so partial responses are preserved on refresh
                    if (conversationId && streamedContent) {
                        try {
                            // Build final content: clean text + real sources (if any)
                            const finalContent = sourcesBlock
                                ? `${streamedContent.replace(/\n*<!--SOURCES:\n[\s\S]*?-->/g, '').trim()}\n\n${sourcesBlock}`
                                : streamedContent

                            const { error: saveError } = await supabase
                                .from('messages')
                                .insert({
                                    conversation_id: conversationId,
                                    role: 'assistant',
                                    content: finalContent
                                })

                            if (saveError) {
                                console.error('Failed to save assistant message:', saveError)
                            } else if (projectId && streamedContent) {
                                // ═══════════════════════════════════════════════
                                // MEMORY EXTRACTION (via job queue)
                                // ═══════════════════════════════════════════════
                                import('@/lib/jobs').then(j => {
                                    j.enqueueJob('MEMORY_EXTRACTION', {
                                        projectId,
                                        text: streamedContent,
                                        source: 'chat',
                                        sourceId: conversationId
                                    }, projectId)
                                }).catch(e => console.error('[Memory] Job enqueue failed:', e))
                            }
                        } catch (e) {
                            console.error('Error saving assistant message:', e)
                        }
                    }

                    if (!controllerClosed) {
                        safeEnqueue(encoder.encode(phaseEvent('complete', 'end')))
                        safeEnqueue(encoder.encode('data: [DONE]\n\n'))
                        try { controller.close() } catch { /* already closed */ }
                    }
                } catch (err) {
                    console.error('Stream error:', err)
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
