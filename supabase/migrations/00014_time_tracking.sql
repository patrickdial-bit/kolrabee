-- Time clock tracking for subcontractors (Growth+ feature).
-- Per-sub toggle in subcontractor_settings; entries in time_entries.

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE subcontractor_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  time_clock_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subcontractor_settings_tenant ON subcontractor_settings(tenant_id);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL
      THEN CAST(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60 AS INTEGER)
      ELSE NULL
    END
  ) STORED,
  notes TEXT,
  edited_by_admin_id UUID REFERENCES users(id),
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clock_out_after_clock_in CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE INDEX idx_time_entries_sub_clock_in     ON time_entries(subcontractor_id, clock_in DESC);
CREATE INDEX idx_time_entries_project_clock_in ON time_entries(project_id, clock_in DESC);
CREATE INDEX idx_time_entries_tenant           ON time_entries(tenant_id);

-- One open entry per sub.
CREATE UNIQUE INDEX idx_time_entries_one_open_per_sub
  ON time_entries(subcontractor_id)
  WHERE clock_out IS NULL;

-- =============================================================================
-- updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subcontractor_settings_updated_at
  BEFORE UPDATE ON subcontractor_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE subcontractor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries           ENABLE ROW LEVEL SECURITY;

-- subcontractor_settings ----------------------------------------------------
CREATE POLICY "Admins manage settings"
  ON subcontractor_settings FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Subs read own settings"
  ON subcontractor_settings FOR SELECT
  USING (subcontractor_id = auth_user_id());

-- time_entries --------------------------------------------------------------
CREATE POLICY "Subs read own entries"
  ON time_entries FOR SELECT
  USING (subcontractor_id = auth_user_id());

CREATE POLICY "Subs insert own entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    subcontractor_id = auth_user_id()
    AND tenant_id    = auth_tenant_id()
    AND auth_role()  = 'subcontractor'
  );

CREATE POLICY "Subs update own entries"
  ON time_entries FOR UPDATE
  USING      (subcontractor_id = auth_user_id())
  WITH CHECK (subcontractor_id = auth_user_id());

CREATE POLICY "Admins read tenant entries"
  ON time_entries FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins update tenant entries"
  ON time_entries FOR UPDATE
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
