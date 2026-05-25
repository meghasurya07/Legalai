-- H3: Make vector columns flexible to accept both 1536 and 3072 dimensions
-- This allows gradual migration: new embeddings use 3072, old ones stay at 1536
-- The cosine similarity functions work correctly across different dimensions in pgvector

-- Drop existing HNSW indexes (they are dimension-specific)
DROP INDEX IF EXISTS idx_file_chunks_embedding_hnsw;
DROP INDEX IF EXISTS idx_memories_embedding_hnsw;
DROP INDEX IF EXISTS idx_memories_embedding_ivfflat;

-- Alter columns to unspecified dimension vector (accepts any size)
ALTER TABLE IF EXISTS file_chunks ALTER COLUMN embedding TYPE vector;
ALTER TABLE IF EXISTS memories ALTER COLUMN embedding TYPE vector;

-- Recreate hybrid search RPC without dimension constraint
CREATE OR REPLACE FUNCTION match_file_chunks_hybrid(
    query_embedding vector,
    query_text text,
    target_project_id uuid,
    match_count int DEFAULT 20,
    target_file_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid, file_id uuid, project_id uuid, content text, chunk_index int,
    page_number int, section_heading text, token_count int, similarity float, text_rank float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT fc.id, fc.file_id, fc.project_id, fc.content, fc.chunk_index, fc.page_number,
               fc.section_heading, fc.token_count,
               1 - (fc.embedding <=> query_embedding) AS similarity, 0::float AS text_rank
        FROM file_chunks fc
        WHERE fc.project_id = target_project_id
          AND (target_file_id IS NULL OR fc.file_id = target_file_id)
          AND fc.embedding IS NOT NULL
        ORDER BY fc.embedding <=> query_embedding
        LIMIT match_count
    ),
    text_results AS (
        SELECT fc.id, fc.file_id, fc.project_id, fc.content, fc.chunk_index, fc.page_number,
               fc.section_heading, fc.token_count, 0::float AS similarity,
               ts_rank_cd(to_tsvector('english', fc.content), plainto_tsquery('english', query_text)) AS text_rank
        FROM file_chunks fc
        WHERE fc.project_id = target_project_id
          AND (target_file_id IS NULL OR fc.file_id = target_file_id)
          AND to_tsvector('english', fc.content) @@ plainto_tsquery('english', query_text)
        ORDER BY text_rank DESC
        LIMIT match_count
    ),
    combined AS (SELECT * FROM vector_results UNION ALL SELECT * FROM text_results),
    deduped AS (
        SELECT DISTINCT ON (combined.id)
            combined.id, combined.file_id, combined.project_id, combined.content,
            combined.chunk_index, combined.page_number, combined.section_heading, combined.token_count,
            MAX(combined.similarity) AS similarity, MAX(combined.text_rank) AS text_rank
        FROM combined
        GROUP BY combined.id, combined.file_id, combined.project_id, combined.content,
                 combined.chunk_index, combined.page_number, combined.section_heading, combined.token_count
    )
    SELECT * FROM deduped ORDER BY similarity DESC, text_rank DESC LIMIT match_count;
END;
$$;

-- Recreate match_memories without dimension constraint
CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector,
    target_project_id uuid,
    match_count int DEFAULT 5,
    similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    id uuid, content text, memory_type text, confidence float, metadata jsonb, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.content, m.memory_type, m.confidence::float, m.metadata,
           1 - (m.embedding <=> query_embedding) AS similarity
    FROM memories m
    WHERE m.project_id = target_project_id AND m.is_active = true
      AND m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
