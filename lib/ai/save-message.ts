import { supabase } from '@/lib/supabase/server'
import { logMemoryAccess, reinforceMemory } from '@/lib/memory'
import type { MemoryRetrievalResult } from '@/lib/memory'
import { logger } from '@/lib/logger'

interface SaveAssistantMessageParams {
    conversationId: string
    streamedContent: string
    sourcesBlock: string
    projectId?: string | null
    orgId?: string
    userId: string
    usedMemories: MemoryRetrievalResult[]
}

/**
 * Persist an assistant message to the database and trigger background jobs
 * (memory extraction, argument extraction, memory access logging).
 */
export async function saveAssistantMessage({
    conversationId,
    streamedContent,
    sourcesBlock,
    projectId,
    orgId,
    userId,
    usedMemories,
}: SaveAssistantMessageParams): Promise<string | null> {
    try {
        const finalContent = sourcesBlock
            ? `${streamedContent.replace(/\n*<!--SOURCES:\n[\s\S]*?-->/g, '').trim()}\n\n${sourcesBlock}`
            : streamedContent

        const { data: savedMsg, error: saveError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: finalContent
            })
            .select('id')
            .single()

        if (saveError) {
            logger.error('save-message', 'Failed to save assistant message', saveError)
            return null
        } else if (projectId && streamedContent) {
            // Enqueue background jobs
            import('@/lib/jobs').then(j => {
                j.enqueueJob('MEMORY_EXTRACTION', {
                    projectId,
                    organizationId: orgId,
                    userId,
                    text: streamedContent,
                    source: 'chat',
                    sourceId: conversationId
                }, projectId)

                // Silent argument extraction (Phase 4)
                j.enqueueJob('ARGUMENT_EXTRACTION', {
                    projectId,
                    organizationId: orgId,
                    text: streamedContent,
                    conversationId
                }, projectId)
            }).catch(e => logger.error('save-message', 'Memory job enqueue failed', e))

            // Log memory usage for learning loop
            if (usedMemories.length > 0) {
                Promise.allSettled(
                    usedMemories.map(m =>
                        Promise.all([
                            logMemoryAccess({
                                memoryId: m.id,
                                conversationId,
                                userId,
                                retrievalScore: m.relevance_score,
                                wasCited: true,
                            }),
                            reinforceMemory(m.id),
                        ])
                    )
                ).catch(() => {})
            }
        }
        return savedMsg?.id || null
    } catch (e) {
        logger.error('save-message', 'Error saving assistant message', e)
        return null
    }
}
