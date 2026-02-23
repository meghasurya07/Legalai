-- ============================================
-- VAULT RAG: Vector Similarity Search Function
-- ============================================
-- Run this migration in Supabase SQL Editor AFTER 001_file_chunks.sql
CREATE OR REPLACE FUNCTION match_file_chunks(
        query_embedding vector(1536),
        match_project_id UUID,
        match_count INTEGER DEFAULT 10
    ) RETURNS TABLE (
        id UUID,
        file_id UUID,
        project_id UUID,
        content TEXT,
        token_count INTEGER,
        chunk_index INTEGER,
        file_name TEXT,
        page_number INTEGER,
        section_heading TEXT,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT fc.id,
    fc.file_id,
    fc.project_id,
    fc.content,
    fc.token_count,
    fc.chunk_index,
    fc.file_name,
    fc.page_number,
    fc.section_heading,
    1 - (fc.embedding <=> query_embedding) AS similarity
FROM file_chunks fc
WHERE fc.project_id = match_project_id
    AND fc.embedding IS NOT NULL
ORDER BY fc.embedding <=> query_embedding
LIMIT match_count;
END;
$$;