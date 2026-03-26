-- ============================================
-- ETHICAL WALLS (Information Barriers)
-- ============================================
-- Prevents lawyers on conflicting matters from
-- accessing each other's projects and data.
-- Required by ABA Model Rules for multi-practice firms.

-- 1. Ethical Walls (barrier definitions)
CREATE TABLE IF NOT EXISTS ethical_walls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ethical_walls_org ON ethical_walls(org_id);
CREATE INDEX IF NOT EXISTS idx_ethical_walls_org_status ON ethical_walls(org_id, status);

-- 2. Wall Members (users granted access through the wall)
CREATE TABLE IF NOT EXISTS ethical_wall_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wall_id UUID NOT NULL REFERENCES ethical_walls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wall_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wall_members_wall ON ethical_wall_members(wall_id);
CREATE INDEX IF NOT EXISTS idx_wall_members_user ON ethical_wall_members(user_id);

-- 3. Wall Projects (projects behind the wall)
CREATE TABLE IF NOT EXISTS ethical_wall_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wall_id UUID NOT NULL REFERENCES ethical_walls(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wall_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_wall_projects_wall ON ethical_wall_projects(wall_id);
CREATE INDEX IF NOT EXISTS idx_wall_projects_project ON ethical_wall_projects(project_id);

-- Composite index for enforcement queries:
-- "Which walls protect this project?"
CREATE INDEX IF NOT EXISTS idx_wall_projects_project_wall
    ON ethical_wall_projects(project_id, wall_id);
