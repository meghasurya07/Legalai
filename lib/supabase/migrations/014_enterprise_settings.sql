-- Migration: 014_enterprise_settings.sql
-- 1. Organization Settings
CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    -- General Settings
    default_project_visibility TEXT DEFAULT 'organization',
    -- 'private', 'team', 'organization'
    allow_external_sharing BOOLEAN DEFAULT false,
    -- Data & Compliance
    data_retention_days INTEGER DEFAULT 2555,
    -- 7 years default for legal
    document_encryption_enabled BOOLEAN DEFAULT true,
    audit_logging_enabled BOOLEAN DEFAULT true,
    ai_training_opt_out BOOLEAN DEFAULT true,
    storage_region TEXT DEFAULT 'us-east',
    -- AI Governance
    assistant_context_scope TEXT DEFAULT 'project',
    -- 'project', 'organization'
    workflow_execution_limits INTEGER DEFAULT 100,
    auto_insights_enabled BOOLEAN DEFAULT true,
    conflict_detection_enabled BOOLEAN DEFAULT true,
    clause_extraction_enabled BOOLEAN DEFAULT true,
    strict_grounding_mode BOOLEAN DEFAULT true,
    hallucination_guard_level TEXT DEFAULT 'strict',
    -- 'standard', 'strict'
    ai_memory_persistence BOOLEAN DEFAULT true,
    workflows_all_docs_access BOOLEAN DEFAULT false,
    -- File / Vault
    allowed_file_types TEXT [] DEFAULT ARRAY ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    max_file_size_mb INTEGER DEFAULT 50,
    ocr_enabled BOOLEAN DEFAULT true,
    auto_analysis_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_settings_id ON organization_settings(organization_id);
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
-- 2. Team Settings (Overrides)
CREATE TABLE IF NOT EXISTS team_settings (
    team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    project_visibility_override TEXT DEFAULT NULL,
    external_sharing_override BOOLEAN DEFAULT NULL,
    ai_scope_override TEXT DEFAULT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_settings_id ON team_settings(team_id);
ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;
-- 3. User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    -- Auth0 ID or internal user ID. Let's use internal user ID if we have one, or just TEXT for Auth0 id. 
    -- Assuming users are UUID based on organization_members table, let's use UUID.
    user_id UUID PRIMARY KEY,
    default_org_id UUID REFERENCES organizations(id) ON DELETE
    SET NULL,
        assistant_language TEXT DEFAULT 'en',
        timezone TEXT DEFAULT 'UTC',
        updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_settings_id ON user_settings(user_id);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
-- Backfill existing organizations with default settings
INSERT INTO organization_settings (organization_id)
SELECT id
FROM organizations ON CONFLICT (organization_id) DO NOTHING;