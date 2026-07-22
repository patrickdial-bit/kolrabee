-- =============================================================================
-- 00035: Marketing engine — Phase 1 (prove the loop)
-- Lead capture (M4) → dispatch handoff (M5) → attribution to collected
-- revenue (M6), per docs/MARKETING_ENGINE_V1_SPEC.md.
--
-- projects.revenue_amount is the customer-side revenue on a job (what the
-- customer pays the tenant, distinct from payout_amount which is what the
-- tenant pays the sub). Attribution counts it as "collected" once the
-- project reaches status 'paid'.
-- =============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS revenue_amount NUMERIC(12,2);

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS mk_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'meta' CHECK (channel IN ('meta', 'google', 'other')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  monthly_budget NUMERIC(12,2),
  -- Manually maintained in Phase 1; ad-platform API sync replaces it later.
  spend_to_date NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Matched against inbound utm_campaign to auto-associate leads.
  utm_campaign VARCHAR(200),
  external_campaign_id VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_campaigns_tenant ON mk_campaigns(tenant_id);

CREATE TABLE IF NOT EXISTS mk_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES mk_campaigns(id) ON DELETE SET NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'landing_form' CHECK (source IN (
    'landing_form', 'meta_lead_form', 'google', 'sms', 'call', 'chat', 'referral', 'manual'
  )),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(30),
  address TEXT,
  service_requested VARCHAR(200),
  message TEXT,
  -- Click IDs captured at landing: the start of the attribution chain.
  fbclid TEXT,
  gclid TEXT,
  utm_source VARCHAR(200),
  utm_medium VARCHAR(200),
  utm_campaign VARCHAR(200),
  -- Transparent deterministic score with per-signal reasons (JSONB array).
  score INT,
  score_reasons JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'booked', 'lost'
  )),
  -- Set when the lead converts to a job (M5 handoff).
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_leads_tenant_created ON mk_leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mk_leads_tenant_status ON mk_leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mk_leads_campaign ON mk_leads(campaign_id);

CREATE TABLE IF NOT EXISTS mk_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES mk_leads(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  detail TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_lead_events_lead ON mk_lead_events(lead_id, created_at);

-- updated_at triggers (shared set_updated_at() from 00014)
DROP TRIGGER IF EXISTS mk_campaigns_updated_at ON mk_campaigns;
CREATE TRIGGER mk_campaigns_updated_at
  BEFORE UPDATE ON mk_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS mk_leads_updated_at ON mk_leads;
CREATE TRIGGER mk_leads_updated_at
  BEFORE UPDATE ON mk_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY — admin-only; leads are written via the service role
-- from the public capture endpoint and read/managed by tenant admins.
-- =============================================================================

ALTER TABLE mk_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tenant campaigns" ON mk_campaigns;
CREATE POLICY "Admins manage tenant campaigns"
  ON mk_campaigns FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant leads" ON mk_leads;
CREATE POLICY "Admins manage tenant leads"
  ON mk_leads FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins manage tenant lead events" ON mk_lead_events;
CREATE POLICY "Admins manage tenant lead events"
  ON mk_lead_events FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
