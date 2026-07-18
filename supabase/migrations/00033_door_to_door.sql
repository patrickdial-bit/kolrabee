-- =============================================================================
-- 00033: Door-to-door jobs
-- Adds an hourly-paid "door to door" project type and a door_knocks table for
-- rep canvassing activity: one row per door with an outcome disposition,
-- optional note, optional address, and optional GPS pin captured at tap time.
-- Hourly pay reuses the existing time_entries clock; payout for door-to-door
-- jobs is computed as clocked hours × hourly_rate when the job is marked paid.
-- =============================================================================

-- Project type + hourly rate
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(20) NOT NULL DEFAULT 'standard';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2);

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_type_check
  CHECK (project_type IN ('standard', 'door_to_door'));

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS door_knocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN (
    'not_home', 'not_interested', 'callback', 'lead', 'appointment', 'sale', 'do_not_knock'
  )),
  address TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  knocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_door_knocks_project ON door_knocks(project_id, knocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_knocks_sub ON door_knocks(subcontractor_id, knocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_knocks_tenant ON door_knocks(tenant_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE door_knocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subs read own knocks" ON door_knocks;
CREATE POLICY "Subs read own knocks"
  ON door_knocks FOR SELECT
  USING (subcontractor_id = auth_user_id());

DROP POLICY IF EXISTS "Subs insert own knocks" ON door_knocks;
CREATE POLICY "Subs insert own knocks"
  ON door_knocks FOR INSERT
  WITH CHECK (
    subcontractor_id = auth_user_id()
    AND tenant_id    = auth_tenant_id()
    AND auth_role()  = 'subcontractor'
  );

DROP POLICY IF EXISTS "Subs delete own knocks" ON door_knocks;
CREATE POLICY "Subs delete own knocks"
  ON door_knocks FOR DELETE
  USING (subcontractor_id = auth_user_id());

DROP POLICY IF EXISTS "Admins read tenant knocks" ON door_knocks;
CREATE POLICY "Admins read tenant knocks"
  ON door_knocks FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins delete tenant knocks" ON door_knocks;
CREATE POLICY "Admins delete tenant knocks"
  ON door_knocks FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
