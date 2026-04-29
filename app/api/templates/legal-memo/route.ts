import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow/handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'legal_memo',
        inputMode: 'json',
        responseKey: 'memo',
        workflowId: 'legal-memo'
    })
}
