-- ============================================================================
-- Photo Module (Phase 1) — jobsite photo capture, filing, and gallery.
--
-- Replaces CompanyCam for crews: per-project photo capture that auto-files to
-- the right project, stamped with timestamp + GPS, compressed client-side, and
-- viewable in a per-job gallery. Multi-tenant, tenant_id-scoped, RLS-enforced.
--
-- Reconciliation note: the canonical spec assumes a `memberships(user_id,
-- tenant_id, role)` table. This codebase instead uses the app-level `users`
-- table (supabase_auth_id -> tenant_id/role) together with the existing
-- SECURITY DEFINER helpers auth_tenant_id(), auth_role(), and auth_user_id().
-- All policies below use those helpers, so tenant isolation is one hop.
-- ============================================================================

CREATE TABLE IF NOT EXISTS photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  storage_path  TEXT NOT NULL,          -- full-size object key in jobsite-photos
  thumb_path    TEXT NOT NULL,          -- thumbnail object key
  taken_at      TIMESTAMPTZ,            -- from EXIF or client clock at capture
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  caption       TEXT,
  tags          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ['before','after','prep','damage','materials',...]
  width         INT,
  height        INT,
  bytes         INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS photos_project_idx ON photos (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_tenant_idx  ON photos (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_tags_idx    ON photos USING gin (tags);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- Read scoped to tenant; insert must stamp self as uploader; update by uploader
-- or tenant admin; delete by admin only (crews shouldn't be able to nuke job
-- evidence).
-- ============================================================================

DROP POLICY IF EXISTS "photos_select" ON photos;
CREATE POLICY "photos_select"
  ON photos FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "photos_insert" ON photos;
CREATE POLICY "photos_insert"
  ON photos FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND uploaded_by = auth_user_id()
  );

DROP POLICY IF EXISTS "photos_update" ON photos;
CREATE POLICY "photos_update"
  ON photos FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (uploaded_by = auth_user_id() OR auth_role() = 'admin')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (uploaded_by = auth_user_id() OR auth_role() = 'admin')
  );

DROP POLICY IF EXISTS "photos_delete" ON photos;
CREATE POLICY "photos_delete"
  ON photos FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- ============================================================================
-- STORAGE BUCKET + STORAGE RLS
-- Private bucket; served only via signed URLs. Object key convention:
--   {tenant_id}/{project_id}/{photo_id}.jpg
--   {tenant_id}/{project_id}/{photo_id}_thumb.jpg
-- The first path segment is the tenant_id, so tenant isolation is enforced at
-- the storage layer too — a user cannot drop files into another tenant folder
-- even if the DB row insert is bypassed.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('jobsite-photos', 'jobsite-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "read jobsite photos" ON storage.objects;
CREATE POLICY "read jobsite photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'jobsite-photos'
    AND (storage.foldername(name))[1]::uuid = auth_tenant_id()
  );

DROP POLICY IF EXISTS "write jobsite photos" ON storage.objects;
CREATE POLICY "write jobsite photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'jobsite-photos'
    AND (storage.foldername(name))[1]::uuid = auth_tenant_id()
  );

DROP POLICY IF EXISTS "delete jobsite photos" ON storage.objects;
CREATE POLICY "delete jobsite photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'jobsite-photos'
    AND (storage.foldername(name))[1]::uuid = auth_tenant_id()
    AND auth_role() = 'admin'
  );
