-- Migration: 018_memory_layer.sql
-- Purpose: Upgrade Wesley memory system to multi-layered intelligence architecture
-- Adds: memories (with pgvector), arguments, clause_patterns, firm_patterns, memory_access_log
-- Data migration: copies existing project_memory into new memories table

-- ============================================
-- 1. ENABLE pgvector EXTENSION
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 2. MEMORIES — Unified intelligent memory store
-- ============================================
CREATE TABLE IF NOT EXISTS memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT,

    -- Core content
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'fact', 'decision', 'risk', 'obligation', 'insight',
        'preference', 'argument', 'outcome', 'procedure',
        'pattern', 'correction'
    )),
    content TEXT NOT NULL,
    embedding vector(1536),

    -- Provenance
    source TEXT NOT NULL CHECK (source IN ('chat', 'document', 'workflow', 'manual', 'system')),
    source_id UUID,
    source_context TEXT,

    -- Intelligence weights
    confidence FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    importance INTEGER NOT NULL DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
    authority_weight FLOAT NOT NULL DEFAULT 1.0 CHECK (authority_weight >= 0 AND authority_weight <= 1),
    decay_weight FLOAT NOT NULL DEFAULT 1.0 CHECK (decay_weight >= 0 AND decay_weight <= 1),
    reinforcement_count INTEGER NOT NULL DEFAULT 0,

    -- User controls
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_accessed_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite indexes for retrieval
CREATE INDEX IF NOT EXISTS idx_memories_project_type_active
    ON memories (project_id, memory_type, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_memories_org_type_active
    ON memories (organization_id, memory_type, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_memories_user_type
    ON memories (user_id, memory_type)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_importance_decay
    ON memories (importance DESC, decay_weight DESC)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_memories_pinned
    ON memories (project_id, is_pinned)
    WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_memories_decay_stale
    ON memories (decay_weight, reinforcement_count)
    WHERE is_active = true AND decay_weight < 0.2;

-- pgvector HNSW index for fast approximate nearest neighbor
CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw
    ON memories USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- 3. ARGUMENTS — Legal argument tracking
-- ============================================
CREATE TABLE IF NOT EXISTS arguments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    argument_text TEXT NOT NULL,
    argument_type TEXT NOT NULL CHECK (argument_type IN (
        'offense', 'defense', 'procedural', 'evidentiary', 'statutory', 'constitutional'
    )),
    jurisdiction TEXT,
    practice_area TEXT,
    court_level TEXT,

    -- Outcome tracking
    outcome TEXT CHECK (outcome IN ('won', 'lost', 'settled', 'pending', 'partial')),
    outcome_notes TEXT,
    outcome_date TIMESTAMPTZ,

    -- Related entities
    related_entity_ids UUID[] DEFAULT '{}',
    related_memory_ids UUID[] DEFAULT '{}',

    -- Embedding for semantic search
    embedding vector(1536),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arguments_project
    ON arguments (project_id);

CREATE INDEX IF NOT EXISTS idx_arguments_org_type
    ON arguments (organization_id, argument_type);

CREATE INDEX IF NOT EXISTS idx_arguments_jurisdiction
    ON arguments (organization_id, jurisdiction)
    WHERE jurisdiction IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arguments_outcome
    ON arguments (outcome)
    WHERE outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arguments_embedding_hnsw
    ON arguments USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- 4. CLAUSE PATTERNS — Recurring clause structures
-- ============================================
CREATE TABLE IF NOT EXISTS clause_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    clause_type TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    source_project_ids UUID[] DEFAULT '{}',
    source_file_ids UUID[] DEFAULT '{}',

    embedding vector(1536),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clause_patterns_org_type
    ON clause_patterns (organization_id, clause_type);

CREATE INDEX IF NOT EXISTS idx_clause_patterns_embedding_hnsw
    ON clause_patterns USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- 5. FIRM PATTERNS — Org-wide aggregated intelligence
-- ============================================
CREATE TABLE IF NOT EXISTS firm_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'clause_standard', 'risk_distribution', 'argument_success_rate',
        'jurisdiction_preference', 'common_procedure', 'negotiation_pattern'
    )),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    confidence FLOAT NOT NULL DEFAULT 0.5,

    source_project_ids UUID[] DEFAULT '{}',
    access_level TEXT NOT NULL DEFAULT 'admin' CHECK (access_level IN ('admin', 'lawyer', 'all')),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firm_patterns_org_type
    ON firm_patterns (organization_id, pattern_type);

CREATE INDEX IF NOT EXISTS idx_firm_patterns_access
    ON firm_patterns (organization_id, access_level);

-- ============================================
-- 6. MEMORY ACCESS LOG — Usage tracking for learning loop
-- ============================================
CREATE TABLE IF NOT EXISTS memory_access_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    conversation_id UUID,
    user_id TEXT,

    retrieval_score FLOAT,
    was_cited BOOLEAN DEFAULT false,
    feedback TEXT CHECK (feedback IN ('positive', 'negative', NULL)),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_access_log_memory
    ON memory_access_log (memory_id);

CREATE INDEX IF NOT EXISTS idx_memory_access_log_conversation
    ON memory_access_log (conversation_id);

-- ============================================
-- 7. RPC — Vector similarity search for memories
-- ============================================
CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_project_id UUID DEFAULT NULL,
    filter_org_id UUID DEFAULT NULL,
    filter_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    memory_type TEXT,
    source TEXT,
    confidence FLOAT,
    importance INTEGER,
    authority_weight FLOAT,
    decay_weight FLOAT,
    reinforcement_count INTEGER,
    is_pinned BOOLEAN,
    project_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.content,
        m.memory_type,
        m.source,
        m.confidence,
        m.importance,
        m.authority_weight,
        m.decay_weight,
        m.reinforcement_count,
        m.is_pinned,
        m.project_id,
        m.metadata,
        m.created_at,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM memories m
    WHERE m.is_active = true
        AND m.embedding IS NOT NULL
        AND 1 - (m.embedding <=> query_embedding) > match_threshold
        AND (filter_project_id IS NULL OR m.project_id = filter_project_id)
        AND (filter_org_id IS NULL OR m.organization_id = filter_org_id)
        AND (filter_types IS NULL OR m.memory_type = ANY(filter_types))
    ORDER BY
        m.is_pinned DESC,
        similarity * m.importance * m.authority_weight * m.decay_weight DESC
    LIMIT match_count;
END;
$$;

-- ============================================
-- 8. RPC — Vector similarity search for arguments
-- ============================================
CREATE OR REPLACE FUNCTION match_arguments(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_org_id UUID DEFAULT NULL,
    filter_jurisdiction TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    argument_text TEXT,
    argument_type TEXT,
    jurisdiction TEXT,
    practice_area TEXT,
    outcome TEXT,
    outcome_notes TEXT,
    project_id UUID,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.argument_text,
        a.argument_type,
        a.jurisdiction,
        a.practice_area,
        a.outcome,
        a.outcome_notes,
        a.project_id,
        a.created_at,
        1 - (a.embedding <=> query_embedding) AS similarity
    FROM arguments a
    WHERE a.embedding IS NOT NULL
        AND 1 - (a.embedding <=> query_embedding) > match_threshold
        AND (filter_org_id IS NULL OR a.organization_id = filter_org_id)
        AND (filter_jurisdiction IS NULL OR a.jurisdiction = filter_jurisdiction)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ============================================
-- 9. DATA MIGRATION — project_memory → memories
-- ============================================
-- Migrate existing project_memory rows into new memories table
-- They won't have embeddings or org_id yet; Phase 1C backfill handles that
INSERT INTO memories (
    project_id,
    memory_type,
    content,
    source,
    source_id,
    importance,
    confidence,
    authority_weight,
    metadata,
    created_at
)
SELECT
    pm.project_id,
    pm.memory_type,
    pm.content,
    pm.source,
    pm.source_id,
    pm.importance,
    0.8,              -- migrated data gets 0.8 confidence
    0.7,              -- chat-derived (most legacy data is from chat)
    pm.metadata,
    pm.created_at
FROM project_memory pm
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. RLS POLICIES
-- ============================================
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_access_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all tables (API routes use service role)
CREATE POLICY memories_service_all ON memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY arguments_service_all ON arguments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY clause_patterns_service_all ON clause_patterns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY firm_patterns_service_all ON firm_patterns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY memory_access_log_service_all ON memory_access_log FOR ALL USING (true) WITH CHECK (true);
