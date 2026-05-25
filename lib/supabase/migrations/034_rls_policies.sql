-- M5: Enable RLS on file_chunks
-- M11: Add proper RLS policies (org-based access control)

-- Enable RLS on key tables
ALTER TABLE IF EXISTS file_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_relationships ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for API routes using service_role key)
DO $$ BEGIN DROP POLICY IF EXISTS file_chunks_service_role ON file_chunks; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY file_chunks_service_role ON file_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN DROP POLICY IF EXISTS memories_service_role ON memories; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY memories_service_role ON memories FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN DROP POLICY IF EXISTS entities_service_role ON project_entities; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY entities_service_role ON project_entities FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN DROP POLICY IF EXISTS relationships_service_role ON project_relationships; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY relationships_service_role ON project_relationships FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated user policies (access via project → org membership)
DO $$ BEGIN DROP POLICY IF EXISTS file_chunks_org_access ON file_chunks; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY file_chunks_org_access ON file_chunks FOR SELECT TO authenticated
    USING (project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()::text
    ));

DO $$ BEGIN DROP POLICY IF EXISTS memories_org_access ON memories; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY memories_org_access ON memories FOR SELECT TO authenticated
    USING (project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()::text
    ));

DO $$ BEGIN DROP POLICY IF EXISTS entities_org_access ON project_entities; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY entities_org_access ON project_entities FOR SELECT TO authenticated
    USING (project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()::text
    ));

DO $$ BEGIN DROP POLICY IF EXISTS relationships_org_access ON project_relationships; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY relationships_org_access ON project_relationships FOR SELECT TO authenticated
    USING (project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()::text
    ));
