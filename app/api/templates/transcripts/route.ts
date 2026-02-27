import { NextRequest } from 'next/server'
import { handleWorkflowRequest } from '@/lib/workflow-handler'

export async function POST(request: NextRequest) {
    return handleWorkflowRequest(request, {
        promptType: 'transcript_analysis',
        fileField: 'file',
        workflowId: 'transcripts'
    })
}
