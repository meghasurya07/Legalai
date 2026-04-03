/**
 * Knowledge Graph — Core Types
 */

export type EntityType =
    | 'party'
    | 'document'
    | 'clause'
    | 'obligation'
    | 'risk'
    | 'fact'
    | 'argument'
    | 'outcome'
    | 'precedent'
    | 'clause_pattern'
    | 'judge'
    | 'jurisdiction'

export type EntitySource = 'doc' | 'workflow' | 'chat'

export type RelationshipType =
    | 'HAS_PARTY'
    | 'HAS_CLAUSE'
    | 'HAS_OBLIGATION'
    | 'HAS_RISK'
    | 'REFERENCES'
    | 'AMENDS'
    | 'CONFLICTS_WITH'
    | 'RELATED_TO'
    | 'ARGUED_FOR'
    | 'RESULTED_IN'
    | 'CITES_PRECEDENT'
    | 'IN_JURISDICTION'
    | 'BEFORE_JUDGE'
    | 'USES_CLAUSE'
    | 'SIMILAR_TO'

export interface GraphEntity {
    id: string
    project_id: string
    entity_type: EntityType
    name: string
    normalized_name: string
    source: EntitySource
    ref_id?: string
    metadata: Record<string, unknown>
    created_at: string
}

export interface GraphRelationship {
    id: string
    project_id: string
    source_entity_id: string
    target_entity_id: string
    relationship_type: RelationshipType
    evidence_text?: string
    ref_id?: string
    created_at: string
}

export interface ExtractedEntity {
    name: string
    type: EntityType
}

export interface ExtractedRelationship {
    source_name: string
    target_name: string
    type: RelationshipType
    evidence?: string
}

export interface ProjectGraph {
    entities: GraphEntity[]
    relationships: GraphRelationship[]
}
