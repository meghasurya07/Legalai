-- ============================================
-- CALENDAR EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting', 'hearing', 'deposition', 'filing', 'consultation', 'internal', 'other')),

  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  location TEXT,

  recurrence_rule TEXT,
  recurrence_end TIMESTAMPTZ,

  color TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEADLINES
-- ============================================
CREATE TABLE IF NOT EXISTS deadlines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  deadline_type TEXT NOT NULL DEFAULT 'filing'
    CHECK (deadline_type IN ('filing', 'statute_of_limitations', 'discovery', 'motion', 'response', 'compliance', 'custom')),

  due_at TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'missed')),

  remind_before_minutes INTEGER DEFAULT 1440,

  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cal_events_user ON calendar_events(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_date ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_cal_events_project ON calendar_events(project_id);

CREATE INDEX IF NOT EXISTS idx_deadlines_user ON deadlines(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due ON deadlines(due_at);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON deadlines(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_project ON deadlines(project_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own events"
  ON calendar_events FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage their own deadlines"
  ON deadlines FOR ALL
  USING (true)
  WITH CHECK (true);
