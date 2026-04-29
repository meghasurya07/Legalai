/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { ChatInterface } from "@/components/chat/chat-interface"

export default function ChatConversationPage() {
    const params = useParams()
    const id = params.id as string

    const [conversationMeta, setConversationMeta] = React.useState<{
        type: string
        projectId?: string
        workflowId?: string
    } | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)

    React.useEffect(() => {
        const loadConversationMeta = async () => {
            try {
                const res = await fetch(`/api/chat/conversations/${id}`)
                if (res.ok) {
                    const data = await res.json()
                    setConversationMeta({
                        type: data.type || 'assistant',
                        projectId: data.projectId,
                        workflowId: data.workflowId
                    })
                }
            } catch (error) {
            } finally {
                setIsLoading(false)
            }
        }
        loadConversationMeta()
    }, [id])

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-0">
                <div className="text-muted-foreground text-sm">Loading conversation...</div>
            </div>
        )
    }

    return (
        <div className="flex flex-1 min-h-0 flex-col">
            <ChatInterface
                initialConversationId={id}
                conversationType={(conversationMeta?.type as 'assistant' | 'documents' | 'templates') || 'assistant'}
                projectId={conversationMeta?.projectId}
                workflowId={conversationMeta?.workflowId}
            />
        </div>
    )
}
