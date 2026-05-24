-- =============================================================================
-- Ads Agent v1 (single-tenant prototype for Painter1)
--
-- Adds the creative-generation add-on: a per-tenant feature toggle, a brand kit,
-- generation runs, generated ad concepts, a generic audit log, and a private
-- Storage bucket for seed + generated images and ZIP exports.
--
-- Conventions follow the rest of this schema: VARCHAR + CHECK for enums,
-- IF NOT EXISTS / DROP POLICY IF EXISTS for idempotency, and the existing
-- auth_tenant_id()/auth_role()/auth_user_id() RLS helpers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: is the current auth user a platform super-admin?
-- Used so super-admins can manage add-on settings even when querying with a
-- non-service-role client. (Most writes still go through the service role,
-- which bypasses RLS entirely.)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE supabase_auth_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- ad_addon_settings — master per-tenant feature flag + compliance gate
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_addon_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at        TIMESTAMPTZ,
  enabled_by        UUID REFERENCES users(id),
  compliance_status VARCHAR(20) NOT NULL DEFAULT 'testing_only'
                    CHECK (compliance_status IN ('testing_only', 'cleared_for_paid')),
  monthly_run_limit INT NOT NULL DEFAULT 4,
  runs_this_month   INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- ad_brand_kits — one brand kit per tenant; inputs for every run
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_brand_kits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  brand_name          TEXT NOT NULL DEFAULT '',
  service_line        TEXT NOT NULL DEFAULT '',
  brand_website_url   TEXT,
  primary_color_hex   TEXT NOT NULL DEFAULT '#1E3A8A',
  secondary_color_hex TEXT NOT NULL DEFAULT '#0D1B2A',
  accent_color_hex    TEXT,
  font_family         TEXT NOT NULL DEFAULT 'sans-serif',
  brand_voice         TEXT NOT NULL DEFAULT '',
  value_props         TEXT[] NOT NULL DEFAULT '{}',
  target_geo          TEXT NOT NULL DEFAULT '',
  target_audience     TEXT NOT NULL DEFAULT '',
  seed_image_urls     TEXT[] NOT NULL DEFAULT '{}',
  seed_image_sources  JSONB NOT NULL DEFAULT '[]',
  logo_url            TEXT,
  competitor_page_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- ad_generation_runs — one row per "generate weekly creative" execution
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_generation_runs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_kit_id              UUID REFERENCES ad_brand_kits(id) ON DELETE SET NULL,
  status                    VARCHAR(24) NOT NULL DEFAULT 'queued'
                            CHECK (status IN (
                              'queued', 'scraping', 'synthesizing',
                              'generating_images', 'writing_copy',
                              'ready_for_review', 'failed'
                            )),
  error_message             TEXT,
  triggered_by              UUID REFERENCES users(id),
  competitor_scrape_summary JSONB,
  synthesized_angles        JSONB,
  total_cost_cents          INT NOT NULL DEFAULT 0,
  concepts_generated        INT NOT NULL DEFAULT 0,
  concepts_approved         INT NOT NULL DEFAULT 0,
  concepts_exported         INT NOT NULL DEFAULT 0,
  started_at                TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_runs_tenant_created
  ON ad_generation_runs(tenant_id, created_at DESC);

-- One in-flight run per tenant (security note §9: rate limit POST /api/ads/runs).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_runs_one_active_per_tenant
  ON ad_generation_runs(tenant_id)
  WHERE status IN ('queued', 'scraping', 'synthesizing', 'generating_images', 'writing_copy');

-- -----------------------------------------------------------------------------
-- ad_concepts — up to 20 generated concepts per run
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_concepts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id        UUID NOT NULL REFERENCES ad_generation_runs(id) ON DELETE CASCADE,
  angle         TEXT NOT NULL DEFAULT '',
  variant_index INT NOT NULL DEFAULT 1,
  variant_type  VARCHAR(20) NOT NULL DEFAULT 'lifestyle'
                CHECK (variant_type IN ('lifestyle', 'studio', 'testimonial_style', 'before_after')),
  headline      TEXT NOT NULL DEFAULT '',
  primary_text  TEXT NOT NULL DEFAULT '',
  image_url     TEXT,
  image_prompt  TEXT NOT NULL DEFAULT '',
  status        VARCHAR(12) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_concepts_run    ON ad_concepts(run_id);
CREATE INDEX IF NOT EXISTS idx_ad_concepts_tenant ON ad_concepts(tenant_id);

-- -----------------------------------------------------------------------------
-- audit_events — generic tenant-scoped audit log (approve/reject/export/etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id),
  action     VARCHAR(64) NOT NULL,
  entity_id  UUID,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created
  ON audit_events(tenant_id, created_at DESC);

-- =============================================================================
-- updated_at triggers (set_updated_at() defined in 00014)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_ad_addon_settings_updated_at ON ad_addon_settings;
CREATE TRIGGER trg_ad_addon_settings_updated_at
  BEFORE UPDATE ON ad_addon_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ad_brand_kits_updated_at ON ad_brand_kits;
CREATE TRIGGER trg_ad_brand_kits_updated_at
  BEFORE UPDATE ON ad_brand_kits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- App code authenticates the user (getCurrentUser) and then reads/writes via the
-- service-role client, which bypasses RLS. These policies are defense-in-depth
-- for any anon-key access and enforce tenant isolation (spec §9: non-negotiable).
-- =============================================================================
ALTER TABLE ad_addon_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_brand_kits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_concepts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events       ENABLE ROW LEVEL SECURITY;

-- ad_addon_settings: tenant members read own; only super-admins write.
DROP POLICY IF EXISTS "Tenant reads own addon settings" ON ad_addon_settings;
CREATE POLICY "Tenant reads own addon settings"
  ON ad_addon_settings FOR SELECT
  USING (tenant_id = auth_tenant_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Super admins manage addon settings" ON ad_addon_settings;
CREATE POLICY "Super admins manage addon settings"
  ON ad_addon_settings FOR ALL
  USING (auth_is_super_admin())
  WITH CHECK (auth_is_super_admin());

-- ad_brand_kits: tenant members read; admins manage.
DROP POLICY IF EXISTS "Tenant reads own brand kit" ON ad_brand_kits;
CREATE POLICY "Tenant reads own brand kit"
  ON ad_brand_kits FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "Admins manage brand kit" ON ad_brand_kits;
CREATE POLICY "Admins manage brand kit"
  ON ad_brand_kits FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- ad_generation_runs: tenant members read; admins manage.
DROP POLICY IF EXISTS "Tenant reads own runs" ON ad_generation_runs;
CREATE POLICY "Tenant reads own runs"
  ON ad_generation_runs FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "Admins manage runs" ON ad_generation_runs;
CREATE POLICY "Admins manage runs"
  ON ad_generation_runs FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- ad_concepts: tenant members read; admins manage (approve/reject).
DROP POLICY IF EXISTS "Tenant reads own concepts" ON ad_concepts;
CREATE POLICY "Tenant reads own concepts"
  ON ad_concepts FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "Admins manage concepts" ON ad_concepts;
CREATE POLICY "Admins manage concepts"
  ON ad_concepts FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- audit_events: tenant admins read own tenant; inserts via service role only.
DROP POLICY IF EXISTS "Admins read tenant audit" ON audit_events;
CREATE POLICY "Admins read tenant audit"
  ON audit_events FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- =============================================================================
-- Storage bucket: ad-assets (private; access via signed URLs from service role)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-assets', 'ad-assets', false)
ON CONFLICT (id) DO NOTHING;
