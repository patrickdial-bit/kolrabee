-- Crew Leader / Crew Member roles for subcontractors.
-- Crew Leader is a capability flag on existing subcontractor users (no new auth role).
-- Crew Members are roster entries (no login). Time entries gain an optional crew_member_id;
-- the leader (subcontractor_id) remains the accountable owner of every entry.

-- =============================================================================
-- users.is_crew_leader
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_crew_leader BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
  SET is_crew_leader = TRUE
  WHERE role = 'subcontractor' AND status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_crew_leader_only_for_subs'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_crew_leader_only_for_subs
      CHECK (is_crew_leader = FALSE OR role = 'subcontractor');
  END IF;
END $$;

-- =============================================================================
-- crew_members
-- =============================================================================

CREATE TABLE IF NOT EXISTS crew_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crew_leader_id  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  first_name      TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name       TEXT NOT NULL CHECK (length(trim(last_name))  > 0),
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_members_leader_active
  ON crew_members(crew_leader_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_crew_members_tenant ON crew_members(tenant_id);

DROP TRIGGER IF EXISTS trg_crew_members_updated_at ON crew_members;
CREATE TRIGGER trg_crew_members_updated_at
  BEFORE UPDATE ON crew_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- time_entries.crew_member_id
-- =============================================================================

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS crew_member_id UUID REFERENCES crew_members(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_time_entries_crew_member
  ON time_entries(crew_member_id, clock_in DESC)
  WHERE crew_member_id IS NOT NULL;

-- Replace the single "one open entry per sub" index with two scoped variants.
DROP INDEX IF EXISTS idx_time_entries_one_open_per_sub;

CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_open_per_leader
  ON time_entries(subcontractor_id)
  WHERE clock_out IS NULL AND crew_member_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_open_per_member
  ON time_entries(crew_member_id)
  WHERE clock_out IS NULL AND crew_member_id IS NOT NULL;

-- Cross-table integrity: when crew_member_id is set, the referenced row must
-- belong to the same tenant and the same leader as the time entry.
CREATE OR REPLACE FUNCTION enforce_crew_member_entry_integrity()
RETURNS TRIGGER AS $$
DECLARE
  cm RECORD;
BEGIN
  IF NEW.crew_member_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tenant_id, crew_leader_id
    INTO cm
    FROM crew_members
    WHERE id = NEW.crew_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'crew_member % not found', NEW.crew_member_id;
  END IF;
  IF cm.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'crew_member tenant mismatch';
  END IF;
  IF cm.crew_leader_id <> NEW.subcontractor_id THEN
    RAISE EXCEPTION 'crew_member does not belong to this leader';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_time_entries_crew_integrity ON time_entries;
CREATE TRIGGER trg_time_entries_crew_integrity
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_crew_member_entry_integrity();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaders manage own crew" ON crew_members;
CREATE POLICY "Leaders manage own crew"
  ON crew_members FOR ALL
  USING      (crew_leader_id = auth_user_id() AND tenant_id = auth_tenant_id())
  WITH CHECK (crew_leader_id = auth_user_id() AND tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "Admins read tenant crew" ON crew_members;
CREATE POLICY "Admins read tenant crew"
  ON crew_members FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins update tenant crew" ON crew_members;
CREATE POLICY "Admins update tenant crew"
  ON crew_members FOR UPDATE
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- time_entries policies are unchanged: subcontractor_id = auth_user_id() is the
-- leader on every row (own entries and crew entries alike), so existing INSERT
-- and UPDATE policies already cover crew rows. The trigger above prevents
-- cross-tenant or cross-leader tampering.
