import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow/handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'draft_from_template',
        inputMode: 'json',
        responseKey: 'document',
        workflowId: 'draft-from-template'
    })
}
