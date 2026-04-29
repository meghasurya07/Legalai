import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow/handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'translation',
        fileField: 'file',
        additionalFields: ['targetLanguage'],
        workflowId: 'translation'
    })
}
