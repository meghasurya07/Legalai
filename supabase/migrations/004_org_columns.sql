-- ============================================
-- MULTI-TENANT: Add org_id to existing tables
-- ============================================
-- Run this migration in Supabase SQL Editor AFTER 003_organizations.sql

-- Add org_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);

-- Add org_id to files
ALTER TABLE files ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_files_org ON files(org_id);

-- Add org_id to file_chunks
ALTER TABLE file_chunks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_file_chunks_org ON file_chunks(org_id);

-- Add org_id to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(org_id);

-- Add org_id to system_logs
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_system_logs_org ON system_logs(org_id);

-- Add org_id to recent_chats (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recent_chats') THEN
        EXECUTE 'ALTER TABLE recent_chats ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_recent_chats_org ON recent_chats(org_id)';
    END IF;
END $$;
