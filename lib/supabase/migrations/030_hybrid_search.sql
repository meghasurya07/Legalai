-- Migration: 030_hybrid_search.sql
-- Purpose: Add full-text search (BM25 equivalent) to file_chunks for hybrid retrieval
--
-- Creates:
--   1. tsvector column + GIN index for full-text search
--   2. Trigger to auto-populate tsvector on INSERT/UPDATE
--   3. match_file_chunks_hybrid() RPC — combined vector + full-text search with RRF
--   4. Backfill existing chunks with tsvector values

-- ============================================
-- 1. ADD tsvector COLUMN to file_chunks
-- ============================================
ALTER TABLE file_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- ============================================
-- 2. GIN INDEX for fast full-text search
-- ============================================
CREATE INDEX IF NOT EXISTS idx_file_chunks_content_tsv
    ON file_chunks USING GIN (content_tsv);

-- ============================================
-- 3. TRIGGER: auto-populate tsvector on write
-- ============================================
CREATE OR REPLACE FUNCTION file_chunks_tsv_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.content_tsv := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_file_chunks_tsv ON file_chunks;
CREATE TRIGGER trg_file_chunks_tsv
    BEFORE INSERT OR UPDATE OF content ON file_chunks
    FOR EACH ROW
    EXECUTE FUNCTION file_chunks_tsv_trigger();

-- ============================================
-- 4. BACKFILL existing rows
-- ============================================
UPDATE file_chunks
SET content_tsv = to_tsvector('english', COALESCE(content, ''))
WHERE content_tsv IS NULL;

-- ============================================
-- 5. HYBRID SEARCH RPC
-- Combines vector similarity (cosine) with full-text search (BM25 rank)
-- using Reciprocal Rank Fusion (RRF) for result merging.
--
-- Parameters:
--   query_embedding  — vector embedding of the user query
--   query_text       — raw text query for full-text search
--   match_project_id — project scope
--   match_count      — max results to return
--   similarity_threshold — minimum vector similarity (default 0.5)
--   rrf_k            — RRF constant (default 60, standard value from literature)
-- ============================================
CREATE OR REPLACE FUNCTION match_file_chunks_hybrid(
    query_embedding vector(1536),
    query_text TEXT,
    match_project_id UUID,
    match_count INTEGER DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.5,
    rrf_k INTEGER DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    file_id UUID,
    project_id UUID,
    content TEXT,
    token_count INTEGER,
    chunk_index INTEGER,
    file_name TEXT,
    page_number INTEGER,
    section_heading TEXT,
    similarity FLOAT,
    text_rank FLOAT,
    rrf_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    -- Build tsquery from raw text (handles multi-word queries)
    ts_query := plainto_tsquery('english', query_text);

    RETURN QUERY
    WITH
    -- Vector search results with rank
    vector_results AS (
        SELECT
            fc.id,
            ROW_NUMBER() OVER (ORDER BY fc.embedding <=> query_embedding) AS vec_rank,
            1 - (fc.embedding <=> query_embedding) AS vec_similarity
        FROM file_chunks fc
        WHERE fc.project_id = match_project_id
            AND fc.embedding IS NOT NULL
            AND 1 - (fc.embedding <=> query_embedding) > similarity_threshold
        ORDER BY fc.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    -- Full-text search results with rank
    text_results AS (
        SELECT
            fc.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fc.content_tsv, ts_query) DESC) AS txt_rank,
            ts_rank_cd(fc.content_tsv, ts_query) AS txt_score
        FROM file_chunks fc
        WHERE fc.project_id = match_project_id
            AND fc.content_tsv IS NOT NULL
            AND fc.content_tsv @@ ts_query
        ORDER BY ts_rank_cd(fc.content_tsv, ts_query) DESC
        LIMIT match_count * 3
    ),
    -- Reciprocal Rank Fusion: combine scores from both methods
    rrf AS (
        SELECT
            COALESCE(v.id, t.id) AS chunk_id,
            COALESCE(1.0 / (rrf_k + v.vec_rank), 0) AS vec_rrf,
            COALESCE(1.0 / (rrf_k + t.txt_rank), 0) AS txt_rrf,
            COALESCE(v.vec_similarity, 0) AS vec_sim,
            COALESCE(t.txt_score, 0) AS txt_sc
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT
        fc.id,
        fc.file_id,
        fc.project_id,
        fc.content,
        fc.token_count,
        fc.chunk_index,
        fc.file_name,
        fc.page_number,
        fc.section_heading,
        rrf.vec_sim::FLOAT AS similarity,
        rrf.txt_sc::FLOAT AS text_rank,
        (rrf.vec_rrf + rrf.txt_rrf)::FLOAT AS rrf_score
    FROM rrf
    INNER JOIN file_chunks fc ON fc.id = rrf.chunk_id
    ORDER BY (rrf.vec_rrf + rrf.txt_rrf) DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_file_chunks_hybrid TO service_role;
GRANT EXECUTE ON FUNCTION match_file_chunks_hybrid TO authenticated;
