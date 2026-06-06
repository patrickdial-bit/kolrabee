-- ============================================================================
-- CompanyCam one-time import (Phase 3) — bring a tenant's CompanyCam projects
-- ("customers") and photos into Kolrabee's photo module.
--
-- Imported projects/photos are flagged source='companycam' and live alongside
-- native data in Galleries / All Photos. Imported projects get status='imported'
-- which matches none of the dispatch status tabs, so they never leak into the
-- dispatch workflow. Dedupe/resumability is keyed on companycam_id per tenant.
-- ============================================================================

-- Provenance columns -------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'kolrabee';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS companycam_id TEXT;
ALTER TABLE photos   ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'kolrabee';
ALTER TABLE photos   ADD COLUMN IF NOT EXISTS companycam_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_tenant_companycam
  ON projects (tenant_id, companycam_id) WHERE companycam_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_photos_tenant_companycam
  ON photos (tenant_id, companycam_id) WHERE companycam_id IS NOT NULL;

-- Allow the 'imported' status (kept distinct from dispatch statuses) ---------
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status::text = ANY (ARRAY[
    'available','accepted','in_progress','completed','paid','cancelled','imported'
  ]::text[]));

-- Per-tenant CompanyCam connection (personal access token) ------------------
-- Token is sensitive: admin-only RLS, and app reads it via the service role.
CREATE TABLE IF NOT EXISTS companycam_connections (
  tenant_id      UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  api_token      TEXT NOT NULL,
  connected_by   UUID REFERENCES users(id),
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_import_at TIMESTAMPTZ
);
ALTER TABLE companycam_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companycam_connections_rw ON companycam_connections;
CREATE POLICY companycam_connections_rw ON companycam_connections FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Import job tracking (one-time, resumable, chunked) ------------------------
CREATE TABLE IF NOT EXISTS companycam_import_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'pending',   -- pending | running | completed | failed
  phase          TEXT NOT NULL DEFAULT 'projects',  -- projects | photos | done
  page           INT  NOT NULL DEFAULT 1,           -- current list page within the phase
  projects_done  INT  NOT NULL DEFAULT 0,
  photos_done    INT  NOT NULL DEFAULT 0,
  photos_failed  INT  NOT NULL DEFAULT 0,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS companycam_import_jobs_tenant_idx
  ON companycam_import_jobs (tenant_id, created_at DESC);

ALTER TABLE companycam_import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companycam_import_jobs_rw ON companycam_import_jobs;
CREATE POLICY companycam_import_jobs_rw ON companycam_import_jobs FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- At most one active (pending/running) import per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_companycam_active_job
  ON companycam_import_jobs (tenant_id) WHERE status IN ('pending','running');
