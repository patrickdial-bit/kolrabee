-- =============================================================================
-- 00037: Marketing engine MVP — Data Labs, Competitor Intelligence, Prospector,
-- usage metering. Public-data-only boundary: every scrape source must pass the
-- mk_source_policies gate before any run may target it (rebuild spec §4/§11).
-- Voting records are excluded from enrichment by policy — no schema for them.
-- =============================================================================

-- =============================================================================
-- Source policy gate (global reference, not tenant-scoped). A scrape run may
-- only target sources with status 'approved'. Seeded with the current policy:
-- public/official APIs approved; login-required directories blocked.
-- =============================================================================

CREATE TABLE IF NOT EXISTS mk_source_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'blocked')),
  basis TEXT NOT NULL,               -- written policy basis for the status
  requires_login BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO mk_source_policies (source_key, display_name, status, basis, requires_login, reviewed_at) VALUES
  ('meta_ad_library',    'Meta Ad Library API',            'approved', 'Official public API; requires Meta app review before live pulls.', FALSE, NOW()),
  ('google_transparency','Google Ads Transparency Center', 'approved', 'Public transparency data published by Google.', FALSE, NOW()),
  ('google_places',      'Google Places API',              'approved', 'Official paid API under Google Maps Platform licence.', FALSE, NOW()),
  ('county_parcel',      'County auditor/assessor bulk data', 'approved', 'Public record; free bulk download from Ohio county auditors.', FALSE, NOW()),
  ('published_benchmarks','Published CPL/CPC benchmarks',  'approved', 'Publicly published industry reports stored as reference data.', FALSE, NOW()),
  ('bbb',                'BBB',                            'blocked',  'ToS review outstanding; blocked until a written per-source policy clears it.', FALSE, NULL),
  ('thumbtack',          'Thumbtack',                      'blocked',  'Requires login; outside the public-data boundary.', TRUE, NULL),
  ('homeadvisor',        'HomeAdvisor/Angi',               'blocked',  'Requires login; outside the public-data boundary.', TRUE, NULL),
  ('houzz',              'Houzz',                          'blocked',  'ToS review outstanding; blocked until cleared.', FALSE, NULL),
  ('nextdoor',           'Nextdoor',                       'blocked',  'Requires login; outside the public-data boundary.', TRUE, NULL),
  ('voter_file',         'Voter registration data',        'blocked',  'Prohibited permanently: commercial-use restrictions and no legitimate benefit (spec §6 MUST-FIX).', FALSE, NOW())
ON CONFLICT (source_key) DO NOTHING;

-- =============================================================================
-- Data Labs: scrape runs + competitor profiles + competitor ads + benchmarks
-- =============================================================================

CREATE TABLE IF NOT EXISTS mk_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_key VARCHAR(50) NOT NULL REFERENCES mk_source_policies(source_key),
  geography VARCHAR(200) NOT NULL,          -- "Columbus, OH" / metro / radius text
  cadence VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('once', 'daily', 'weekly', 'monthly')),
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'paused', 'cancelled')),
  items_found INT NOT NULL DEFAULT 0,
  cost_cents INT NOT NULL DEFAULT 0,        -- API/proxy/compute cost accounting
  last_error TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_scrape_runs_tenant ON mk_scrape_runs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mk_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  geography VARCHAR(200),
  website TEXT,
  categories TEXT,
  rating NUMERIC(3,2),
  review_count INT,
  social JSONB,                              -- {facebook, instagram, ...} public handles
  ad_activity BOOLEAN NOT NULL DEFAULT FALSE,
  score INT,
  score_reasons JSONB,                       -- transparent: [{label, points}]
  provenance JSONB,                          -- {field: {source_key, seen_at}}
  dedupe_key VARCHAR(300),                   -- normalized name+geo
  refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_competitors_tenant ON mk_competitors(tenant_id, score DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mk_competitors_dedupe ON mk_competitors(tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Observed competitor ads. Stores structure/pattern metadata, never verbatim
-- creative for reuse: campaigns are generated from patterns (spec §5 MUST-FIX).
CREATE TABLE IF NOT EXISTS mk_competitor_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES mk_competitors(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL DEFAULT 'meta' CHECK (platform IN ('meta', 'google', 'other')),
  format VARCHAR(30),
  theme VARCHAR(100),                        -- clustered theme, e.g. "financing offer"
  pattern_summary TEXT,                      -- extracted structure, not verbatim copy
  first_seen DATE,
  last_seen DATE,
  run_days INT,                              -- run duration = converting-ad proxy
  library_url TEXT,                          -- link back to the public ad library entry
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_competitor_ads_comp ON mk_competitor_ads(competitor_id, run_days DESC NULLS LAST);

-- Published benchmark reference data (global, not tenant-scoped).
CREATE TABLE IF NOT EXISTS mk_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade VARCHAR(50) NOT NULL,
  metro VARCHAR(100) NOT NULL DEFAULT 'us_average',
  cpl_low NUMERIC(8,2),
  cpl_high NUMERIC(8,2),
  cpc_low NUMERIC(8,2),
  cpc_high NUMERIC(8,2),
  source TEXT NOT NULL,
  year INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO mk_benchmarks (trade, metro, cpl_low, cpl_high, cpc_low, cpc_high, source, year) VALUES
  ('landscaping', 'us_average', 25, 80, 3.20, 8.50, 'Published home-services PPC benchmark reports (WordStream/LocaliQ aggregate ranges)', 2025),
  ('painting',    'us_average', 30, 90, 3.50, 9.00, 'Published home-services PPC benchmark reports (WordStream/LocaliQ aggregate ranges)', 2025),
  ('paving',      'us_average', 40, 120, 4.00, 10.00, 'Published home-services PPC benchmark reports (WordStream/LocaliQ aggregate ranges)', 2025)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Prospector: parcel-based homeowner prospects. Enrichment carries per-field
-- provenance; voting data is excluded by policy. Deletion requests remove the
-- row and drop a suppression marker so the address is never re-imported.
-- =============================================================================

CREATE TABLE IF NOT EXISTS mk_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parcel_id VARCHAR(100),
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(10),
  zip VARCHAR(12),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  owner_name VARCHAR(200),
  owner_occupied BOOLEAN,
  year_built INT,
  sqft INT,
  lot_acres NUMERIC(10,3),
  last_sale_date DATE,
  last_sale_price NUMERIC(14,2),
  assessed_value NUMERIC(14,2),
  provenance JSONB,                          -- {field: {source_key, imported_at}}
  score INT,
  score_reasons JSONB,
  suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'targeted', 'mailed', 'converted', 'removed')),
  lead_id UUID REFERENCES mk_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_prospects_tenant ON mk_prospects(tenant_id, score DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mk_prospects_parcel ON mk_prospects(tenant_id, parcel_id) WHERE parcel_id IS NOT NULL;

-- =============================================================================
-- Usage metering: every billable action, per tenant (spec §10 UsageEvent).
-- =============================================================================

CREATE TABLE IF NOT EXISTS mk_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,           -- prospect_import, scrape_run, render, postcard, model_call…
  quantity INT NOT NULL DEFAULT 1,
  unit_cost_cents INT NOT NULL DEFAULT 0,
  ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_usage_tenant ON mk_usage_events(tenant_id, created_at DESC);

-- updated_at triggers
DROP TRIGGER IF EXISTS mk_scrape_runs_updated_at ON mk_scrape_runs;
CREATE TRIGGER mk_scrape_runs_updated_at BEFORE UPDATE ON mk_scrape_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS mk_competitors_updated_at ON mk_competitors;
CREATE TRIGGER mk_competitors_updated_at BEFORE UPDATE ON mk_competitors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS mk_prospects_updated_at ON mk_prospects;
CREATE TRIGGER mk_prospects_updated_at BEFORE UPDATE ON mk_prospects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE mk_source_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_competitor_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read source policies" ON mk_source_policies;
CREATE POLICY "Admins read source policies" ON mk_source_policies FOR SELECT USING (auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins read benchmarks" ON mk_benchmarks;
CREATE POLICY "Admins read benchmarks" ON mk_benchmarks FOR SELECT USING (auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant scrape runs" ON mk_scrape_runs;
CREATE POLICY "Admins manage tenant scrape runs" ON mk_scrape_runs FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant competitors" ON mk_competitors;
CREATE POLICY "Admins manage tenant competitors" ON mk_competitors FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant competitor ads" ON mk_competitor_ads;
CREATE POLICY "Admins manage tenant competitor ads" ON mk_competitor_ads FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant prospects" ON mk_prospects;
CREATE POLICY "Admins manage tenant prospects" ON mk_prospects FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins read tenant usage" ON mk_usage_events;
CREATE POLICY "Admins read tenant usage" ON mk_usage_events FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
