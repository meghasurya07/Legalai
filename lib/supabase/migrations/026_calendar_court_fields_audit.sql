-- ============================================
-- 026: Court/Matter Fields + Audit Log
-- ============================================

-- 1. Add court/matter fields to calendar_events
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS case_number TEXT,
  ADD COLUMN IF NOT EXISTS court_name TEXT,
  ADD COLUMN IF NOT EXISTS judge_name TEXT;

-- 2. Add court/matter fields to deadlines
ALTER TABLE deadlines
  ADD COLUMN IF NOT EXISTS case_number TEXT,
  ADD COLUMN IF NOT EXISTS court_name TEXT,
  ADD COLUMN IF NOT EXISTS judge_name TEXT;

-- 3. Create deadline audit log
CREATE TABLE IF NOT EXISTS deadline_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deadline_id UUID NOT NULL REFERENCES deadlines(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('created', 'status_changed', 'field_updated', 'deleted')),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_deadline ON deadline_audit_log(deadline_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON deadline_audit_log(created_at DESC);

-- 4. Indexes for court/case search
CREATE INDEX IF NOT EXISTS idx_events_case_number ON calendar_events(case_number) WHERE case_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deadlines_case_number ON deadlines(case_number) WHERE case_number IS NOT NULL;

-- 5. Indexes for org-wide queries
CREATE INDEX IF NOT EXISTS idx_events_org ON calendar_events(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deadlines_org ON deadlines(org_id) WHERE org_id IS NOT NULL;
