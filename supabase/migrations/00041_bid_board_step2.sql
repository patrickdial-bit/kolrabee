-- Bid Board build step 2/3 support: scope-code material lookup + bid-packages
-- storage bucket. Spec: docs/bid-board-spec.md ("Scope code parser", "bid_attachments").

-- =============================================================================
-- scope_code_materials — material key for the scope-code parser
-- =============================================================================
-- Rows with tenant_id NULL are global defaults; tenants can override/extend
-- with their own rows (so Jason can add mixes without a code deploy).
-- `ordinal` counts occurrences of a letter FROM THE LAST lift: ordinal 1 is the
-- final (surface) lift and also the bare/default meaning; ordinal 2 is the lift
-- before it, etc. E10S2S4A2.5A1.5: the second S resolves to ordinal 1 (#304),
-- the first S to ordinal 2 (#2 stone); a lone S resolves to ordinal 1 (#304).

CREATE TABLE scope_code_materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global default
  letter        TEXT NOT NULL CHECK (letter IN ('E', 'S', 'A', 'O', 'I', 'OL', 'M', 'P', 'FG')),
  ordinal       INT NOT NULL DEFAULT 1 CHECK (ordinal >= 1),
  material_name TEXT NOT NULL,
  default_spec  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, letter, ordinal)
);

CREATE INDEX idx_scope_code_materials_tenant ON scope_code_materials(tenant_id);

CREATE TRIGGER trg_scope_code_materials_updated_at
  BEFORE UPDATE ON scope_code_materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scope_code_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read materials"
  ON scope_code_materials FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = auth_tenant_id());

CREATE POLICY "Admins manage tenant materials"
  ON scope_code_materials FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Global defaults (spec: bare S = #304, bare A = 448 Type 1; repeated letters
-- are different materials in sequence — earlier lift = coarser/base material).
INSERT INTO scope_code_materials (tenant_id, letter, ordinal, material_name, default_spec) VALUES
  (NULL, 'E',  1, 'Excavate existing',            NULL),
  (NULL, 'S',  1, '#304 stone',                   'ODOT 304'),
  (NULL, 'S',  2, '#2 stone',                     'ODOT #2'),
  (NULL, 'A',  1, '448 Type 1 surface',           'ODOT 448'),
  (NULL, 'A',  2, '301 asphalt base',             'ODOT 301'),
  (NULL, 'OL', 1, 'Overlay prep (mill & clean)',  NULL),
  (NULL, 'M',  1, 'Milling',                      NULL),
  (NULL, 'P',  1, 'Prime coat',                   NULL),
  (NULL, 'FG', 1, 'Fine grade',                   NULL),
  (NULL, 'O',  1, 'O material (configure)',       NULL),
  (NULL, 'I',  1, 'I material (configure)',       NULL);

-- =============================================================================
-- bid-packages storage bucket
-- =============================================================================
-- Object paths are `<tenant_id>/bids/<bid_request_id>/<filename>`; policies
-- scope authenticated access to the caller's tenant prefix. Sub-facing access
-- never touches these policies — it goes through server routes with the
-- service key (signed URLs) after token validation.

INSERT INTO storage.buckets (id, name, public) VALUES ('bid-packages', 'bid-packages', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tenant read bid packages"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bid-packages'
    AND (storage.foldername(name))[1] = (SELECT auth_tenant_id()::text)
  );

CREATE POLICY "Tenant upload bid packages"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bid-packages'
    AND (storage.foldername(name))[1] = (SELECT auth_tenant_id()::text)
  );

CREATE POLICY "Tenant delete bid packages"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bid-packages'
    AND (storage.foldername(name))[1] = (SELECT auth_tenant_id()::text)
  );
