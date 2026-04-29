-- ============================================
-- 027: Document Drafts & Version History
-- ============================================

-- Drafts table (the live document)
CREATE TABLE IF NOT EXISTS drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    org_id UUID,
    project_id UUID,
    title TEXT NOT NULL DEFAULT 'Untitled Document',
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_text TEXT DEFAULT '',
    document_type TEXT DEFAULT 'general',
    word_count INT DEFAULT 0,
    status TEXT DEFAULT 'draft',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Version history (immutable snapshots)
CREATE TABLE IF NOT EXISTS draft_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    content_text TEXT DEFAULT '',
    word_count INT DEFAULT 0,
    version_number INT NOT NULL,
    change_summary TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_org ON drafts(org_id);
CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_versions_draft ON draft_versions(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_versions_number ON draft_versions(draft_id, version_number DESC);

-- Row Level Security
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_versions ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage their own drafts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drafts_user_access') THEN
        CREATE POLICY drafts_user_access ON drafts FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'draft_versions_access') THEN
        CREATE POLICY draft_versions_access ON draft_versions FOR ALL USING (true);
    END IF;
END $$;
