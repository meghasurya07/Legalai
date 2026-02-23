-- Migration: 008_knowledge_graph.sql
-- Purpose: Add project-scoped knowledge graph (entities + relationships)
-- ============================================
-- PROJECT ENTITIES
-- ============================================
CREATE TABLE IF NOT EXISTS project_entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    -- party, document, clause, obligation, risk, fact
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    -- lowercase, trimmed for dedup
    source TEXT NOT NULL,
    -- doc, workflow, chat
    ref_id UUID,
    -- source record ID
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_entities_project_id ON project_entities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_entities_type ON project_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_project_entities_normalized ON project_entities(project_id, normalized_name);
ALTER TABLE project_entities DISABLE ROW LEVEL SECURITY;
-- ============================================
-- PROJECT RELATIONSHIPS
-- ============================================
CREATE TABLE IF NOT EXISTS project_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    source_entity_id UUID REFERENCES project_entities(id) ON DELETE CASCADE,
    target_entity_id UUID REFERENCES project_entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    -- HAS_PARTY, HAS_CLAUSE, HAS_OBLIGATION, HAS_RISK, REFERENCES, AMENDS, CONFLICTS_WITH, RELATED_TO
    evidence_text TEXT,
    ref_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_relationships_project_id ON project_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_project_relationships_source ON project_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_project_relationships_target ON project_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_project_relationships_type ON project_relationships(relationship_type);
ALTER TABLE project_relationships DISABLE ROW LEVEL SECURITY;