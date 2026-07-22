-- =============================================================================
-- 00038: Connectable lead sources. Each source (website form, Meta lead ads,
-- Google lead form, other webhook) gets a secret token that identifies the
-- tenant + source on inbound submissions — no tenant slug exposure needed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS mk_lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('website_form', 'meta_lead_form', 'google_lead_form', 'webhook')),
  token VARCHAR(80) UNIQUE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mk_lead_sources_tenant ON mk_lead_sources(tenant_id);

ALTER TABLE mk_leads ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES mk_lead_sources(id) ON DELETE SET NULL;

ALTER TABLE mk_lead_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage tenant lead sources" ON mk_lead_sources;
CREATE POLICY "Admins manage tenant lead sources"
  ON mk_lead_sources FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
