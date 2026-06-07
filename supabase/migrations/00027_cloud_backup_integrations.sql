-- Cloud backup integrations — let a tenant connect their own cloud drive
-- (Google Drive first; Dropbox / OneDrive planned) so that a folder is created
-- per project and the job's photos + documents can be backed up off-platform.
--
-- tenant_integrations holds one row per tenant per provider. It stores an
-- ENCRYPTED OAuth refresh token (never plaintext — see lib/crypto.ts) plus the
-- id of the tenant-chosen root folder under which per-project folders are made.
-- RLS is enabled with NO policies: these rows (which contain secrets) are only
-- ever read/written by the server via the service-role client, never by the
-- anon/authenticated API. This mirrors the super_admins table's posture.

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('google_drive', 'dropbox', 'onedrive')),
  status VARCHAR(20) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'revoked')),
  account_email VARCHAR(255),
  refresh_token_encrypted TEXT,
  root_folder_id TEXT,
  root_folder_name TEXT,
  auto_create_folders BOOLEAN NOT NULL DEFAULT TRUE,
  last_error TEXT,
  connected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service-role only (holds OAuth secrets).

-- Per-project cloud folder mapping. The folder is created lazily (on project
-- create when a drive is connected, or on first backup) and reused thereafter.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_url TEXT,
  ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMPTZ;
