import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow/handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'redline_analysis',
        fileField: ['original', 'revised'],
        workflowId: 'redline-analysis'
    })
}
