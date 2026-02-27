import { NextRequest, NextResponse } from 'next/server'
import { searchWeb, formatSearchResultsAsContext } from '@/lib/ai/search'
import { callAISafe } from '@/lib/ai/client'
import { apiError, parseAIJSON } from '@/lib/api-utils'
import { supabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const inputData = await request.json()
        const company = inputData.company
        const userPrompt = inputData.prompt

        if (!company) {
            return apiError('Company name is required', 400)
        }

        // 1. Search for company information
        console.log(`[CompanyResearchProfile] Searching for: ${company}`)
        const query = `${company} company research profile legal risks recent news sec filings`
        const searchResponse = await searchWeb(query, 5, 'advanced')
        const searchContext = formatSearchResultsAsContext([searchResponse])

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
        try {
            const { data: conversation } = await supabase
                .from('conversations')
                .insert({
                    title: `Company Research Profile: ${company}`,
                    type: 'workflow',
                    workflow_id: 'company-profile'
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

        return NextResponse.json(parsedResult)

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Workflow execution failed'
        return apiError(message, 500)
    }
}
