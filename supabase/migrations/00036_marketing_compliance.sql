-- =============================================================================
-- 00036: Marketing engine — Phase 0 compliance floor (M13)
-- Consent records, suppression (DNC / opt-out / do-not-mail), household touch
-- ledger, and scrub logs. Per docs/MARKETING_ENGINE_V1_SPEC.md this is the
-- gating layer: no channel that contacts a human ships before this exists, and
-- cold SMS must be technically impossible — the channel lock lives in
-- lib/compliance.ts and reads these tables.
--
-- suppression_scope: 'global' rows are honored across ALL tenants (the
-- Midwest group's shared opt-out — one opt-out suppresses everywhere);
-- 'tenant' rows apply to their tenant only (external tenants). Same table,
-- scope column, per the spec.
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- Consent events, append-only. The latest unrevoked row for a contact wins.
-- Retained 5 years minimum — never hard-delete.
CREATE TABLE IF NOT EXISTS mk_contact_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('phone', 'email')),
  -- Normalized: digits-only for phones, lowercased for emails.
  contact_value VARCHAR(255) NOT NULL,
  consent_type VARCHAR(30) NOT NULL CHECK (consent_type IN (
    'express_written',   -- unlocks SMS (TCPA prior express written consent)
    'express',           -- verbal/implied express — calls ok, not SMS
    'inbound_inquiry'    -- they contacted us — response allowed
  )),
  source TEXT NOT NULL,          -- where consent was captured (form URL, call ref…)
  proof_ref TEXT,                -- link to stored proof (form submission, recording)
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_consent_lookup
  ON mk_contact_consent(tenant_id, contact_type, contact_value);

-- Suppression list: DNC hits, internal opt-outs, do-not-mail, bad addresses.
CREATE TABLE IF NOT EXISTS mk_suppression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_scope VARCHAR(10) NOT NULL DEFAULT 'global' CHECK (suppression_scope IN ('global', 'tenant')),
  -- NULL only for global-scope rows.
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL CHECK (kind IN (
    'dnc_federal', 'dnc_state', 'internal_opt_out', 'do_not_mail', 'bad_address'
  )),
  contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('phone', 'email', 'address')),
  contact_value VARCHAR(500) NOT NULL,   -- normalized (digits / lowercase / collapsed address)
  reason TEXT,
  source TEXT,                            -- scrub batch ref, lead id, call ref…
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tenant_scope_has_tenant CHECK (suppression_scope = 'global' OR tenant_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mk_suppression_lookup
  ON mk_suppression(contact_type, contact_value);
CREATE INDEX IF NOT EXISTS idx_mk_suppression_tenant
  ON mk_suppression(tenant_id) WHERE tenant_id IS NOT NULL;

-- Cross-brand household frequency ledger: one row per outbound touch, keyed by
-- normalized address so the cap is per household, not per brand.
CREATE TABLE IF NOT EXISTS mk_household_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_scope VARCHAR(10) NOT NULL DEFAULT 'global' CHECK (suppression_scope IN ('global', 'tenant')),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  household_key VARCHAR(500) NOT NULL,   -- normalized address
  channel VARCHAR(30) NOT NULL,          -- mail, eddm, door_hanger, call, sms, email…
  campaign_ref TEXT,
  touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_touches_household
  ON mk_household_touches(household_key, touched_at DESC);
CREATE INDEX IF NOT EXISTS idx_mk_touches_tenant
  ON mk_household_touches(tenant_id, touched_at DESC);

-- DNC scrub log: proves every calling list was scrubbed within 31 days.
-- Retained 5 years — never hard-delete.
CREATE TABLE IF NOT EXISTS mk_dnc_scrub_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_ref TEXT,
  registry VARCHAR(20) NOT NULL CHECK (registry IN ('federal', 'ohio', 'internal')),
  numbers_checked INT NOT NULL,
  numbers_matched INT NOT NULL,
  scrubbed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_scrub_tenant
  ON mk_dnc_scrub_log(tenant_id, scrubbed_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY — admins manage their tenant's rows; global suppression
-- rows are readable by any admin (they gate everyone) but written via the
-- service role or by the creating tenant's admin.
-- =============================================================================

ALTER TABLE mk_contact_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_household_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_dnc_scrub_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tenant consent" ON mk_contact_consent;
CREATE POLICY "Admins manage tenant consent"
  ON mk_contact_consent FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins read applicable suppression" ON mk_suppression;
CREATE POLICY "Admins read applicable suppression"
  ON mk_suppression FOR SELECT
  USING (auth_role() = 'admin' AND (suppression_scope = 'global' OR tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "Admins insert suppression" ON mk_suppression;
CREATE POLICY "Admins insert suppression"
  ON mk_suppression FOR INSERT
  WITH CHECK (auth_role() = 'admin' AND (suppression_scope = 'global' OR tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "Admins manage tenant touches" ON mk_household_touches;
CREATE POLICY "Admins manage tenant touches"
  ON mk_household_touches FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant scrub logs" ON mk_dnc_scrub_log;
CREATE POLICY "Admins manage tenant scrub logs"
  ON mk_dnc_scrub_log FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
