-- Migration: 028_red_team_template.sql
-- Purpose: Add the Red Team My Contract template to the templates/workflows table

-- Insert into templates (the runtime table the API queries)
INSERT INTO templates (id, title, description, icon, is_active)
VALUES (
    'red-team',
    'Red Team My Contract',
    'Simulate 6 opposing counsel personas attacking your contract to find loopholes, weak clauses, and exploitable language before the other side does.',
    'Target',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Also insert into workflows (the original schema table, if it exists separately)
INSERT INTO workflows (id, title, description, icon, is_active)
VALUES (
    'red-team',
    'Red Team My Contract',
    'Simulate 6 opposing counsel personas attacking your contract to find loopholes, weak clauses, and exploitable language before the other side does.',
    'Target',
    true
)
ON CONFLICT (id) DO NOTHING;
