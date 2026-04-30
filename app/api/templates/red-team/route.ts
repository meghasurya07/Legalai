import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow/handler'
import { AI_TOKENS } from '@/lib/ai/config'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'red_team_analysis',
        fileField: 'file',
        workflowId: 'red-team',
        maxTokens: AI_TOKENS.redTeam,
    })
}
