-- ============================================
-- MULTI-TENANT: Data Migration
-- ============================================
-- Run this migration in Supabase SQL Editor AFTER 004_org_columns.sql
-- Creates a default org for each existing user and backfills org_id

-- 1. For each unique user_id in projects, create a default organization
INSERT INTO organizations (id, name, slug, created_by_user_id, status, member_count)
SELECT
    gen_random_uuid(),
    'My Organization',
    'org-' || SUBSTRING(p.user_id FROM '[^|]+$'),
    p.user_id,
    'active',
    1
FROM (SELECT DISTINCT user_id FROM projects WHERE user_id IS NOT NULL) p
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om WHERE om.user_id = p.user_id
)
ON CONFLICT DO NOTHING;

-- 2. Add each user as owner of their default org
INSERT INTO organization_members (org_id, user_id, role)
SELECT o.id, o.created_by_user_id, 'owner'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.org_id = o.id AND om.user_id = o.created_by_user_id
)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 3. Backfill org_id on projects
UPDATE projects p
SET org_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by_user_id = p.user_id
    LIMIT 1
)
WHERE p.org_id IS NULL AND p.user_id IS NOT NULL;

-- 4. Backfill org_id on files (via project)
UPDATE files f
SET org_id = (
    SELECT p.org_id FROM projects p WHERE p.id = f.project_id LIMIT 1
)
WHERE f.org_id IS NULL AND f.project_id IS NOT NULL;

-- 5. Backfill org_id on file_chunks (via project)
UPDATE file_chunks fc
SET org_id = (
    SELECT p.org_id FROM projects p WHERE p.id = fc.project_id LIMIT 1
)
WHERE fc.org_id IS NULL AND fc.project_id IS NOT NULL;

-- 6. Backfill org_id on conversations
UPDATE conversations c
SET org_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by_user_id = c.user_id
    LIMIT 1
)
WHERE c.org_id IS NULL AND c.user_id IS NOT NULL;

-- 7. Set default_org_id in user_settings
UPDATE user_settings us
SET default_org_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by_user_id = us.user_id
    LIMIT 1
)
WHERE us.default_org_id IS NULL;

-- Note: org_id columns are kept nullable for now to allow gradual migration.
-- After verifying all data is backfilled, you can run:
-- ALTER TABLE projects ALTER COLUMN org_id SET NOT NULL;
-- ALTER TABLE files ALTER COLUMN org_id SET NOT NULL;
-- etc.
