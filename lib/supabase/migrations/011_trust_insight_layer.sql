-- Migration: 011_trust_insight_layer.sql
-- Purpose: Add trust, conflict, insight, and summary tables
CREATE TABLE IF NOT EXISTS project_conflicts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    conflict_type TEXT NOT NULL,
    entity_a TEXT NOT NULL,
    entity_b TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    related_file_ids UUID [] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_conflicts_project ON project_conflicts(project_id);
ALTER TABLE project_conflicts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS project_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    related_entity_ids UUID [] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_insights_project ON project_insights(project_id);
ALTER TABLE project_insights ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS project_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    summary_text TEXT NOT NULL,
    key_parties JSONB DEFAULT '[]'::jsonb,
    jurisdiction TEXT,
    risks JSONB DEFAULT '[]'::jsonb,
    obligations JSONB DEFAULT '[]'::jsonb,
    conflicts_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_summaries_project ON project_summaries(project_id);
ALTER TABLE project_summaries ENABLE ROW LEVEL SECURITY;