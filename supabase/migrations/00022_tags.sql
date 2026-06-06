-- ============================================================================
-- Tags (Phase 2) — normalized, tenant-scoped tag vocabulary for photos and
-- projects. Replaces the drift-prone `photos.tags jsonb` as the source of
-- truth for filtering (the jsonb column is kept, backfilled, and deprecated —
-- not dropped — so the existing capture insert keeps working).
--
-- Reconciliation note: the canonical spec assumes `memberships(user_id,
-- tenant_id, role)`. This codebase uses the app-level `users` table
-- (supabase_auth_id -> tenant_id/role) with the existing SECURITY DEFINER
-- helpers auth_tenant_id() / auth_user_id() / auth_role() (see 00001, 00021).
-- All policies below use those helpers, so tenant isolation is one hop.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,                       -- optional hex for chip display
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness per tenant — no spelling/case drift.
CREATE UNIQUE INDEX IF NOT EXISTS tags_tenant_name_uniq
  ON tags (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id  UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (photo_id, tag_id)
);

CREATE TABLE IF NOT EXISTS project_tags (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

CREATE INDEX IF NOT EXISTS photo_tags_tag_idx   ON photo_tags (tag_id);
CREATE INDEX IF NOT EXISTS project_tags_tag_idx ON project_tags (tag_id);

-- ============================================================================
-- RLS — tenant-scoped, mirroring the photos policies in 00021.
-- ============================================================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_rw" ON tags;
CREATE POLICY "tags_rw" ON tags FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photo_tags_rw" ON photo_tags;
CREATE POLICY "photo_tags_rw" ON photo_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM photos p
    WHERE p.id = photo_tags.photo_id
      AND p.tenant_id = auth_tenant_id()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM photos p
    WHERE p.id = photo_tags.photo_id
      AND p.tenant_id = auth_tenant_id()));

ALTER TABLE project_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_tags_rw" ON project_tags;
CREATE POLICY "project_tags_rw" ON project_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects pr
    WHERE pr.id = project_tags.project_id
      AND pr.tenant_id = auth_tenant_id()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects pr
    WHERE pr.id = project_tags.project_id
      AND pr.tenant_id = auth_tenant_id()));

-- ============================================================================
-- BACKFILL from the existing photos.tags jsonb.
-- Existing capture already lowercases/trims tags, but we normalize defensively.
-- ============================================================================

-- 1. Seed canonical tags from whatever's already in jsonb.
INSERT INTO tags (tenant_id, name)
SELECT DISTINCT p.tenant_id, trim(t.value)
FROM photos p
CROSS JOIN LATERAL jsonb_array_elements_text(p.tags) AS t(value)
WHERE trim(t.value) <> ''
ON CONFLICT (tenant_id, lower(name)) DO NOTHING;

-- 2. Link photos to those tags.
INSERT INTO photo_tags (photo_id, tag_id)
SELECT p.id, tg.id
FROM photos p
CROSS JOIN LATERAL jsonb_array_elements_text(p.tags) AS t(value)
JOIN tags tg
  ON tg.tenant_id = p.tenant_id
 AND lower(tg.name) = lower(trim(t.value))
WHERE trim(t.value) <> ''
ON CONFLICT DO NOTHING;
