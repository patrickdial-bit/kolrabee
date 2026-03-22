-- Track platform invites (inviting new subs to create an account)
CREATE TABLE platform_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted'
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_platform_invites_tenant ON platform_invites(tenant_id);

-- RLS
ALTER TABLE platform_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their tenant invites"
  ON platform_invites FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid() AND role = 'admin'
  ));
