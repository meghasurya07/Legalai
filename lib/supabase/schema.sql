-- Legal AI MVP Database Schema
-- Simple, extensible schema for single-user local MVP
-- RLS disabled for initial development

-- ============================================
-- PROJECTS (Vault)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    organization TEXT DEFAULT 'Legal AI',
    file_count INTEGER DEFAULT 0,
    query_count INTEGER DEFAULT 0,
    is_secured BOOLEAN DEFAULT true,
    icon TEXT DEFAULT 'folder',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FILES (Vault Documents)
-- ============================================
CREATE TABLE IF NOT EXISTS files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT,
    source TEXT DEFAULT 'upload',
    status TEXT DEFAULT 'ready',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster project file lookups
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);

-- ============================================
-- WORKFLOWS (Static/Seeded)
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKFLOW RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id TEXT REFERENCES workflows(id),
    status TEXT DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for workflow run lookups
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

-- ============================================
-- CONVERSATIONS (Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGES (Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for conversation message lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- ============================================
-- HISTORY ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS history_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    type TEXT NOT NULL,
    preview TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for history type filtering
CREATE INDEX IF NOT EXISTS idx_history_items_type ON history_items(type);
CREATE INDEX IF NOT EXISTS idx_history_items_created_at ON history_items(created_at DESC);

-- ============================================
-- DISABLE RLS FOR MVP (Single-user, no auth)
-- ============================================
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE history_items DISABLE ROW LEVEL SECURITY;
