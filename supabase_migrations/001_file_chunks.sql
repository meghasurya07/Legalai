-- ============================================
-- VAULT RAG: Enable pgvector & Create file_chunks
-- ============================================
-- Run this migration in Supabase SQL Editor
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
-- 2. Create file_chunks table for RAG embeddings
CREATE TABLE IF NOT EXISTS file_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding vector(1536),
    chunk_index INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    page_number INTEGER,
    section_heading TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_project_id ON file_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_project_file ON file_chunks(project_id, file_id);
-- 4. IVFFlat index for vector similarity search
-- Note: IVFFlat requires at least some data to build lists.
-- For small datasets, use exact search (no index needed).
-- For production with >1000 chunks, run:
-- CREATE INDEX idx_file_chunks_embedding ON file_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- For initial setup, use HNSW which works well with any data size:
CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding ON file_chunks USING hnsw (embedding vector_cosine_ops);
-- 5. Disable RLS for MVP (consistent with existing tables)
ALTER TABLE file_chunks DISABLE ROW LEVEL SECURITY;