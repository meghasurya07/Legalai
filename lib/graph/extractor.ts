/**
 * Knowledge Graph — AI-Powered Entity & Relationship Extractor
 * 
 * Extracts entities and relationships from text using AI,
 * then persists them via the entity and relationship managers.
 */

import { callAI } from '@/lib/ai/client'
import { parseAIJSON } from '@/lib/api-utils'
import { upsertEntity } from './entities'
import { addRelationship } from './relationships'
import { ExtractedEntity, ExtractedRelationship, EntitySource } from './types'
import { logger } from '@/lib/logger'

/**
 * Extract entities and relationships from text and persist to graph.
 * Fire-and-forget safe.
 */
export async function extractAndPersistGraph(params: {
    projectId: string
    text: string
    source: EntitySource
    refId?: string
}) {
    const { projectId, text, source, refId } = params

    if (!text || text.length < 50) return

    try {
        logger.info("graph/extractor", `[Graph] Extracting entities from ${source} (${refId || 'no-id'})`)

        const { result } = await callAI('graph_extraction', { text }, {
            jsonMode: true,
            maxTokens: 1200
        })

        const parsed = parseAIJSON(result, undefined)

        const entities: ExtractedEntity[] = Array.isArray(parsed?.entities) ? parsed.entities : []
        const relationships: ExtractedRelationship[] = Array.isArray(parsed?.relationships) ? parsed.relationships : []

        if (entities.length === 0) {
            logger.info("graph/extractor", '[Graph] No entities extracted.')
            return
        }

        // 1. Upsert all entities, build name→id map
        const entityMap = new Map<string, string>()

        for (const entity of entities) {
            try {
                const id = await upsertEntity({
                    projectId,
                    name: entity.name,
                    type: entity.type,
                    source,
                    refId,
                })
                entityMap.set(entity.name.toLowerCase().trim(), id)
            } catch (err) {
                console.error(`[Graph] Failed to upsert entity "${entity.name}":`, err)
            }
        }

        // 2. Create relationships
        let relCount = 0
        for (const rel of relationships) {
            try {
                const sourceId = entityMap.get(rel.source_name.toLowerCase().trim())
                const targetId = entityMap.get(rel.target_name.toLowerCase().trim())

                if (sourceId && targetId) {
                    await addRelationship({
                        projectId,
                        sourceEntityId: sourceId,
                        targetEntityId: targetId,
                        type: rel.type,
                        evidenceText: rel.evidence,
                        refId
                    })
                    relCount++
                }
            } catch (err) {
                console.error(`[Graph] Failed to add relationship:`, err)
            }
        }

        logger.info("graph/extractor", `[Graph] Extracted ${entityMap.size} entities, ${relCount} relationships.`)

    } catch (error) {
        console.error('[Graph] Extraction failed:', error)
    }
}
