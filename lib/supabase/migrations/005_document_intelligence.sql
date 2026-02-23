-- Document Intelligence: structured analysis storage
CREATE TABLE IF NOT EXISTS document_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    summary TEXT,
    parties JSONB DEFAULT '[]',
    effective_date DATE,
    termination_clause TEXT,
    governing_law TEXT,
    key_obligations JSONB DEFAULT '[]',
    risks JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS document_clauses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    clause_type TEXT NOT NULL,
    section_title TEXT,
    section_number TEXT,
    content TEXT NOT NULL,
    chunk_ref UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_analysis_file_id ON document_analysis(file_id);
CREATE INDEX IF NOT EXISTS idx_doc_analysis_project_id ON document_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_doc_clauses_file_id ON document_clauses(file_id);
CREATE INDEX IF NOT EXISTS idx_doc_clauses_project_id ON document_clauses(project_id);
CREATE INDEX IF NOT EXISTS idx_doc_clauses_clause_type ON document_clauses(clause_type);
-- RLS disabled for MVP consistency
ALTER TABLE document_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_clauses DISABLE ROW LEVEL SECURITY;