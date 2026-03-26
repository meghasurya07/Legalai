import { NextRequest, NextResponse } from 'next/server'
import { callAISafe } from '@/lib/ai/client'
import { apiError, parseAIJSON } from '@/lib/api-utils'
import { supabase } from '@/lib/supabase/server'
import { getUserId } from '@/lib/get-user-id'
import { AI_MODELS } from '@/lib/ai/config'
import { resolveOpenAIClient } from '@/lib/byok'

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId()
        const inputData = await request.json()
        const company = inputData.company
        const userPrompt = inputData.prompt

        if (!company) {
            return apiError('Company name is required', 400)
        }

        // 1. Use OpenAI's native web search to research the company
        console.log(`[CompanyResearchProfile] Researching: ${company}`)

        // Resolve org context for BYOK
        let orgId: string | undefined
        try {
            const { getOrgContext } = await import('@/lib/get-org-context')
            const ctx = await getOrgContext()
            orgId = ctx?.orgId
        } catch { /* no org context */ }

        const client = await resolveOpenAIClient(orgId)

        const searchQuery = `${company} company research profile legal risks recent news sec filings`

        const searchResponse = await client.responses.create({
            model: AI_MODELS.companyResearch,
            tools: [{ type: 'web_search' as const }],
            input: [{ role: 'user', content: searchQuery }],
        })

        let searchContext = ''
        if (searchResponse.output) {
            for (const item of searchResponse.output) {
                if (item.type === 'message' && item.content) {
                    for (const block of item.content) {
                        if (block.type === 'output_text' && block.text) {
                            searchContext += block.text + '\n'
                        }
                    }
                }
            }
        }

        // 2. Call AI with search context
        const { result, error } = await callAISafe('company_profile', {
            company,
            searchResults: searchContext,
            userPrompt
        }, { jsonMode: true })

        if (error) {
            return apiError(error, 503)
        }


        const parsedResult = parseAIJSON(result, 'profile')

        // Persist to database
        if (userId) {
            try {
                const { data: conversation } = await supabase
                    .from('conversations')
                    .insert({
                        title: `Company Research Profile: ${company}`,
                        type: 'workflow',
                        workflow_id: 'company-profile',
                        user_id: userId
                    })
                    .select()
                    .single()

                if (conversation) {
                    await supabase.from('messages').insert({
                        conversation_id: conversation.id,
                        role: 'assistant',
                        content: JSON.stringify(parsedResult, null, 2)
                    })
                }
            } catch (e) {
                console.error('Failed to persist company profile:', e)
            }
        }

        return NextResponse.json(parsedResult)

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Workflow execution failed'
        return apiError(message, 500)
    }
}
