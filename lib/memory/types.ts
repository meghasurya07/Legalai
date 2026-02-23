/**
 * Memory Engine — Core Types
 */

export type MemoryType = 'fact' | 'decision' | 'risk' | 'obligation' | 'insight'
export type MemorySource = 'chat' | 'workflow' | 'document'

export interface MemoryItem {
    id: string
    project_id: string
    memory_type: MemoryType
    content: string
    source: MemorySource
    source_id?: string
    importance: number
    metadata?: Record<string, unknown>
    created_at: string
}

export interface ExtractedMemory {
    content: string
    type: MemoryType
    importance: number
    reasoning?: string
}
