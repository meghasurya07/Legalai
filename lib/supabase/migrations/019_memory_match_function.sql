-- Memory Layer: match_memories RPC function for vector similarity search
-- This function is used by the memory retriever for the vector path.

CREATE OR REPLACE FUNCTION match_memories(
    query_embedding TEXT,
    match_threshold DOUBLE PRECISION DEFAULT 0.65,
    match_count INT DEFAULT 15,
    filter_project_id UUID DEFAULT NULL,
    filter_org_id UUID DEFAULT NULL,
    filter_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    memory_type TEXT,
    source TEXT,
    confidence DOUBLE PRECISION,
    importance INT,
    authority_weight DOUBLE PRECISION,
    is_pinned BOOLEAN,
    project_id UUID,
    created_at TIMESTAMPTZ,
    metadata JSONB,
    similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
    embedding_vector vector(1536);
BEGIN
    -- Parse the JSON string to vector
    embedding_vector := query_embedding::vector(1536);

    RETURN QUERY
    SELECT
        m.id,
        m.content,
        m.memory_type::TEXT,
        m.source::TEXT,
        m.confidence,
        m.importance,
        m.authority_weight,
        m.is_pinned,
        m.project_id,
        m.created_at,
        m.metadata,
        1 - (m.embedding <=> embedding_vector) AS similarity
    FROM memories m
    WHERE m.is_active = true
        AND m.embedding IS NOT NULL
        AND (filter_project_id IS NULL OR m.project_id = filter_project_id)
        AND (filter_org_id IS NULL OR m.organization_id = filter_org_id)
        AND (filter_types IS NULL OR m.memory_type::TEXT = ANY(filter_types))
        AND (1 - (m.embedding <=> embedding_vector)) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Index for vector search performance
CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine
ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_memories TO service_role;
GRANT EXECUTE ON FUNCTION match_memories TO anon;
GRANT EXECUTE ON FUNCTION match_memories TO authenticated;
