-- Migration: Add type and workflow_id columns to conversations table
-- Run this in Supabase SQL Editor

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'assistant';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS workflow_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workflow_id ON conversations(workflow_id);
