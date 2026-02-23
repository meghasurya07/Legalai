-- Migration: 006_workflow_engine.sql
-- Purpose: Add support for multi-step workflow execution
-- ============================================
-- WORKFLOW RUNS EXTENSION
-- ============================================
-- Add columns for project context and token tracking
ALTER TABLE workflow_runs
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE
SET NULL,
    ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
-- ============================================
-- WORKFLOW STEPS
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_type TEXT NOT NULL,
    -- 'CLAUSE_ANALYSIS', 'SYNTHESIS', etc.
    step_name TEXT NOT NULL,
    input_context JSONB DEFAULT '{}'::jsonb,
    output_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    -- 'pending', 'running', 'completed', 'failed'
    tokens_used INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_id ON workflow_steps(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
-- Disable RLS for MVP
ALTER TABLE workflow_steps DISABLE ROW LEVEL SECURITY;