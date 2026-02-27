import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow-handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'document_comparison',
        fileField: ['document1', 'document2'],
        workflowId: 'document-comparison'
    })
}
