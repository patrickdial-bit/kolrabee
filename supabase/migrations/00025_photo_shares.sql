-- ============================================================================
-- Photo sharing — public, token-based share links for a project gallery or an
-- individual photo. The token is the capability: the public /share/{token}
-- route reads via the service role (no login). Links auto-expire (default 90
-- days) and are revocable. Admin-only to create/list/revoke within the tenant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS photo_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL CHECK (scope IN ('project', 'photo')),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  photo_id    UUID REFERENCES photos(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT photo_shares_target CHECK (
    (scope = 'project' AND project_id IS NOT NULL) OR
    (scope = 'photo'   AND photo_id  IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS photo_shares_token_idx  ON photo_shares (token);
CREATE INDEX IF NOT EXISTS photo_shares_target_idx ON photo_shares (tenant_id, project_id, photo_id);

ALTER TABLE photo_shares ENABLE ROW LEVEL SECURITY;

-- Manage shares: tenant admins only. (Public read happens via the service role
-- in the share route, gated by the unguessable token — not via RLS.)
DROP POLICY IF EXISTS photo_shares_admin_rw ON photo_shares;
CREATE POLICY photo_shares_admin_rw ON photo_shares FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
