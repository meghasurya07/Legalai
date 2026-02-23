/**
 * Memory Manager
 * 
 * Handles storage and retrieval of project memory items.
 */

import { supabase } from '@/lib/supabase/server'
import { MemoryItem, MemoryType, MemorySource } from './types'

/**
 * Add a memory item to the project.
 */
export async function addMemory(params: {
    projectId: string
    content: string
    type: MemoryType
    source: MemorySource
    sourceId?: string
    importance?: number
    metadata?: Record<string, unknown>
}) {
    const { projectId, content, type, source, sourceId, importance = 3, metadata = {} } = params

    // Basic deduplication: don't add if same content exists for this project in last 1 hour
    const { data: existing } = await supabase
        .from('project_memory')
        .select('id')
        .eq('project_id', projectId)
        .eq('content', content)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .limit(1)

    if (existing && existing.length > 0) {
        console.log('[Memory] Duplicate memory detected, skipping insert.')
        return existing[0].id
    }

    const { data, error } = await supabase
        .from('project_memory')
        .insert({
            project_id: projectId,
            content,
            memory_type: type,
            source,
            source_id: sourceId,
            importance,
            metadata
        })
        .select()
        .single()

    if (error) {
        console.error('[Memory] Failed to add memory:', error)
        throw error
    }

    return data.id
}

/**
 * Retrieve relevant memories for a query.
 * For MVP, uses keyword match. 
 * TODO: Upgrade to pgvector semantic search.
 */
export async function retrieveProjectMemory(projectId: string, query: string, limit: number = 5): Promise<MemoryItem[]> {
    // Build search keywords
    const keywords = query.split(' ').filter(w => w.length > 3).slice(0, 5)

    let dbQuery = supabase
        .from('project_memory')
        .select('*')
        .eq('project_id', projectId)

    if (keywords.length > 0) {
        // Construct OR filter for keywords
        const filterStr = keywords.map(k => `content.ilike.%${k}%`).join(',')
        dbQuery = dbQuery.or(filterStr)
    }

    const { data, error } = await dbQuery
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('[Memory] Failed to retrieve memories:', error)
        return []
    }

    return data as MemoryItem[]
}
