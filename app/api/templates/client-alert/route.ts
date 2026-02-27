import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow-handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'client_alert',
        inputMode: 'json',
        responseKey: 'alert',
        workflowId: 'client-alert'
    })
}
