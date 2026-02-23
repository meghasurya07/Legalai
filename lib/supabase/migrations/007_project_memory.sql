-- Migration: 007_project_memory.sql
-- Purpose: Add support for assistant memory and project intelligence facts
-- ============================================
-- PROJECT MEMORY
-- ============================================
CREATE TABLE IF NOT EXISTS project_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    -- 'fact', 'decision', 'risk', 'obligation', 'insight'
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    -- 'chat', 'workflow', 'document'
    source_id UUID,
    -- MessageID, WorkflowRunID, or FileID
    importance INTEGER DEFAULT 3,
    -- 1-5
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_memory_project_id ON project_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_type ON project_memory(memory_type);
-- Disable RLS for MVP
ALTER TABLE project_memory DISABLE ROW LEVEL SECURITY;