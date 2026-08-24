-- Subcontractor Bid Board (V1) — build step 1: schema + constraints + RLS.
--
-- Renumbered 00040 -> 00043 (and step 2, 00041 -> 00044). While this branch sat
-- unmerged, main shipped 00042; `supabase db push` applies files in lexical
-- order against a recorded high-water mark, so merging as 00040/00041 would
-- have left two migrations sorting behind an already-applied one. Do not
-- renumber these back.
-- Spec: docs/bid-board-spec.md sections 2, 3, 9.
--
-- Naming note: the bid-board spec says `org_id`; this codebase's tenant column
-- is `tenant_id REFERENCES tenants(id)` everywhere, so these tables follow suit.
--
-- The `subcontractors` table here is the bid-board sub *directory* (external
-- companies invited by token, no login). It is distinct from `users` rows with
-- role = 'subcontractor', which remain the price-out flow's accounts.
--
-- Sub-facing access model (spec §9): subs never hold a Supabase session. All
-- sub reads/writes go through server route handlers using the service key
-- after validating the invitation token. Hence RLS below grants admin-only
-- access scoped by tenant; there are intentionally no policies for subs.
-- Invitation tokens are stored hashed (`token_hash`), never in the clear.

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- bid_requests — one round of bidding on an opportunity
-- -----------------------------------------------------------------------------
CREATE TABLE bid_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- External scoping-system opportunity id (MeasureMap/Pipedrive); no local FK.
  opportunity_id         UUID,
  title                  TEXT NOT NULL,
  site_address           TEXT,
  site_lat               NUMERIC(9,6),
  site_lng               NUMERIC(9,6),
  trade                  TEXT,
  scope_narrative        TEXT,
  bids_due_at            TIMESTAMPTZ,
  target_start           DATE,
  target_end             DATE,
  visibility_mode        TEXT NOT NULL DEFAULT 'blind'
                         CHECK (visibility_mode IN ('blind', 'blind_with_count', 'open_low')),
  status                 TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'open', 'closed', 'awarded', 'cancelled')),
  -- Never exposed to subs; sub-facing routes must select columns explicitly.
  internal_budget        NUMERIC(12,2),
  customer_price         NUMERIC(12,2),
  awarded_submission_id  UUID,  -- FK added after bid_submissions exists (circular)
  created_by             UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bid_requests_target_window CHECK (
    target_start IS NULL OR target_end IS NULL OR target_end >= target_start
  )
);

CREATE INDEX idx_bid_requests_tenant_status ON bid_requests(tenant_id, status);
CREATE INDEX idx_bid_requests_opportunity   ON bid_requests(opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- bid_scope_groups — proposal hierarchy: base bid / option / add item / add option
-- -----------------------------------------------------------------------------
CREATE TABLE bid_scope_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id   UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_type       TEXT NOT NULL
                   CHECK (group_type IN ('base_bid', 'option', 'add_item', 'add_option')),
  label            TEXT NOT NULL,
  ordinal          INT,
  parent_group_id  UUID REFERENCES bid_scope_groups(id) ON DELETE CASCADE,
  scope_code       TEXT,
  description      TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  source_ref       TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Spec §3 hierarchy rules (row-local half; parent's type is trigger-checked):
  --   base_bid / option  → stand alone, parent must be NULL
  --   add_item / add_option → parent required
  CONSTRAINT bid_scope_groups_parent_presence CHECK (
    (group_type IN ('base_bid', 'option')     AND parent_group_id IS NULL)
    OR
    (group_type IN ('add_item', 'add_option') AND parent_group_id IS NOT NULL)
  ),
  CONSTRAINT bid_scope_groups_no_self_parent CHECK (parent_group_id IS NULL OR parent_group_id <> id)
);

-- At most one base bid per request ("exactly one" is completed by the app:
-- a request cannot be sent without its base bid group).
CREATE UNIQUE INDEX idx_bid_scope_groups_one_base_bid
  ON bid_scope_groups(bid_request_id)
  WHERE group_type = 'base_bid';

CREATE INDEX idx_bid_scope_groups_request ON bid_scope_groups(bid_request_id, sort_order);
CREATE INDEX idx_bid_scope_groups_parent  ON bid_scope_groups(parent_group_id)
  WHERE parent_group_id IS NOT NULL;
CREATE INDEX idx_bid_scope_groups_tenant  ON bid_scope_groups(tenant_id);

-- Cross-row half of the spec §3 hierarchy rules:
--   add_item   → parent must be base_bid or option
--   add_option → parent may be base_bid, option, or add_item (never add_option)
-- Parent must also belong to the same bid request and tenant.
CREATE OR REPLACE FUNCTION enforce_bid_scope_group_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  parent RECORD;
BEGIN
  IF NEW.parent_group_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT group_type, bid_request_id, tenant_id
    INTO parent
    FROM bid_scope_groups
    WHERE id = NEW.parent_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent scope group % not found', NEW.parent_group_id;
  END IF;
  IF parent.bid_request_id <> NEW.bid_request_id THEN
    RAISE EXCEPTION 'parent scope group belongs to a different bid request';
  END IF;
  IF parent.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'parent scope group tenant mismatch';
  END IF;
  IF NEW.group_type = 'add_item' AND parent.group_type NOT IN ('base_bid', 'option') THEN
    RAISE EXCEPTION 'add_item parent must be base_bid or option, got %', parent.group_type;
  END IF;
  IF NEW.group_type = 'add_option' AND parent.group_type = 'add_option' THEN
    RAISE EXCEPTION 'add_option parent cannot be another add_option';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bid_scope_groups_hierarchy
  BEFORE INSERT OR UPDATE ON bid_scope_groups
  FOR EACH ROW EXECUTE FUNCTION enforce_bid_scope_group_hierarchy();

-- -----------------------------------------------------------------------------
-- bid_scope_items — measured quantities inside a group
-- -----------------------------------------------------------------------------
CREATE TABLE bid_scope_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_scope_group_id UUID NOT NULL REFERENCES bid_scope_groups(id) ON DELETE CASCADE,
  bid_request_id     UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order         INT NOT NULL DEFAULT 0,
  description        TEXT NOT NULL,
  qty                NUMERIC(12,2) CHECK (qty IS NULL OR qty > 0),
  -- UOM whitelist (spec §3): SY for area, LF for linear. SF is rejected by
  -- omission — never silently converted (a sneaked-through SF prices 9x wrong).
  uom                TEXT CHECK (uom IN ('SY', 'LF', 'TON', 'EA', 'LS', 'HR')),
  notes              TEXT,
  source_ref         TEXT,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_scope_items_group   ON bid_scope_items(bid_scope_group_id, sort_order);
CREATE INDEX idx_bid_scope_items_request ON bid_scope_items(bid_request_id);
CREATE INDEX idx_bid_scope_items_tenant  ON bid_scope_items(tenant_id);

-- Denormalized bid_request_id must agree with the group's.
CREATE OR REPLACE FUNCTION enforce_bid_scope_item_request()
RETURNS TRIGGER AS $$
DECLARE
  grp RECORD;
BEGIN
  SELECT bid_request_id, tenant_id
    INTO grp
    FROM bid_scope_groups
    WHERE id = NEW.bid_scope_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scope group % not found', NEW.bid_scope_group_id;
  END IF;
  IF grp.bid_request_id <> NEW.bid_request_id THEN
    RAISE EXCEPTION 'scope item bid_request_id does not match its group';
  END IF;
  IF grp.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'scope item tenant mismatch with its group';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bid_scope_items_request
  BEFORE INSERT OR UPDATE ON bid_scope_items
  FOR EACH ROW EXECUTE FUNCTION enforce_bid_scope_item_request();

-- -----------------------------------------------------------------------------
-- bid_attachments — package files and external links
-- -----------------------------------------------------------------------------
CREATE TABLE bid_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id  UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('upload', 'external_link')),
  attachment_role TEXT NOT NULL DEFAULT 'site_photo'
                  CHECK (attachment_role IN (
                    'takeoff_internal', 'takeoff_proposal', 'site_photo',
                    'plan', 'existing_conditions_doc', 'other'
                  )),
  storage_path    TEXT,   -- Supabase Storage, bucket `bid-packages` (created in step 2)
  external_url    TEXT,   -- Drive folder, Dropbox, etc.
  label           TEXT,
  mime_type       TEXT,
  size_bytes      BIGINT,
  sort_order      INT NOT NULL DEFAULT 0,
  visible_to_subs BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bid_attachments_kind_payload CHECK (
    (kind = 'upload'        AND storage_path IS NOT NULL)
    OR
    (kind = 'external_link' AND external_url IS NOT NULL)
  )
);

CREATE INDEX idx_bid_attachments_request ON bid_attachments(bid_request_id, sort_order);
CREATE INDEX idx_bid_attachments_tenant  ON bid_attachments(tenant_id);

-- -----------------------------------------------------------------------------
-- subcontractors — bid-board sub directory (no login; invited by token)
-- -----------------------------------------------------------------------------
CREATE TABLE subcontractors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  contact_name      TEXT,
  email             TEXT,
  phone             TEXT,
  trades            TEXT[] NOT NULL DEFAULT '{}',
  service_area_zips TEXT[] NOT NULL DEFAULT '{}',
  is_preferred      BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'blocked')),
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subcontractors_tenant_status ON subcontractors(tenant_id, status);
CREATE INDEX idx_subcontractors_trades        ON subcontractors USING GIN (trades);

-- -----------------------------------------------------------------------------
-- sub_compliance_docs — COI / W-9 / license tracking for award gating
-- -----------------------------------------------------------------------------
CREATE TABLE sub_compliance_docs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type         TEXT NOT NULL
                   CHECK (doc_type IN ('coi_gl', 'coi_auto', 'coi_wc', 'w9', 'license', 'mou')),
  storage_path     TEXT,
  issued_on        DATE,
  expires_on       DATE,
  coverage_amount  NUMERIC(12,2),
  verified_by      UUID REFERENCES users(id),
  verified_at      TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Status (valid / expiring_soon / expired / missing) is derived from
  -- expires_on at read time, per spec — never stored.
);

CREATE INDEX idx_sub_compliance_docs_sub     ON sub_compliance_docs(subcontractor_id, doc_type);
CREATE INDEX idx_sub_compliance_docs_tenant  ON sub_compliance_docs(tenant_id);
CREATE INDEX idx_sub_compliance_docs_expires ON sub_compliance_docs(expires_on)
  WHERE expires_on IS NOT NULL;

-- -----------------------------------------------------------------------------
-- bid_invitations — one per sub per request, tokenized, revocable
-- -----------------------------------------------------------------------------
CREATE TABLE bid_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id   UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  -- DEFERRABLE INITIALLY DEFERRED: deleting a sub with bid history fails at
  -- commit, while a tenant cascade that removes both sides in one transaction
  -- succeeds. (A non-deferrable check fires mid-cascade and breaks tenant
  -- deletes — verified empirically on a branch.)
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) DEFERRABLE INITIALLY DEFERRED,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Hash of the 32-byte urlsafe token (spec §9): the clear token is shown once
  -- at send time and never stored. Validation is server-side, constant-time.
  token_hash       TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ,  -- app sets bids_due_at + 7d grace
  status           TEXT NOT NULL DEFAULT 'sent'
                   CHECK (status IN (
                     'sent', 'viewed', 'declined', 'submitted', 'countered',
                     'awarded', 'lost', 'revoked', 'expired'
                   )),
  sent_at          TIMESTAMPTZ,
  first_viewed_at  TIMESTAMPTZ,
  last_viewed_at   TIMESTAMPTZ,
  view_count       INT NOT NULL DEFAULT 0,
  decline_reason   TEXT,
  reminder_count   INT NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bid_request_id, subcontractor_id)
);

CREATE INDEX idx_bid_invitations_request ON bid_invitations(bid_request_id, status);
CREATE INDEX idx_bid_invitations_sub     ON bid_invitations(subcontractor_id);
CREATE INDEX idx_bid_invitations_tenant  ON bid_invitations(tenant_id);

-- -----------------------------------------------------------------------------
-- bid_submissions — revision 1 = original, 2+ = counter rounds
-- -----------------------------------------------------------------------------
CREATE TABLE bid_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_invitation_id UUID NOT NULL REFERENCES bid_invitations(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  revision          INT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  submitted_by      TEXT NOT NULL DEFAULT 'sub'
                    CHECK (submitted_by IN ('sub', 'admin_on_behalf')),
  base_total        NUMERIC(12,2),  -- computed from line items, stored
  alternates_total  NUMERIC(12,2),
  exclusions        TEXT,
  inclusions        TEXT,
  lead_time_days    INT,
  can_meet_window   BOOLEAN,
  proposed_start    DATE,
  proposed_end      DATE,
  mobilizations     INT,
  validity_days     INT NOT NULL DEFAULT 30,
  notes             TEXT,
  attachment_paths  TEXT[] NOT NULL DEFAULT '{}',
  is_current        BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bid_invitation_id, revision),
  CONSTRAINT bid_submissions_proposed_window CHECK (
    proposed_start IS NULL OR proposed_end IS NULL OR proposed_end >= proposed_start
  )
);

-- Only one current submission per invitation.
CREATE UNIQUE INDEX idx_bid_submissions_one_current_per_invitation
  ON bid_submissions(bid_invitation_id)
  WHERE is_current;

CREATE INDEX idx_bid_submissions_tenant ON bid_submissions(tenant_id);

-- Deferred FK from bid_requests (circular reference).
ALTER TABLE bid_requests
  ADD CONSTRAINT fk_bid_requests_awarded_submission
  FOREIGN KEY (awarded_submission_id) REFERENCES bid_submissions(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- bid_line_items — one per scope item, plus sub-added extras
-- -----------------------------------------------------------------------------
CREATE TABLE bid_line_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_submission_id UUID NOT NULL REFERENCES bid_submissions(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- NULL = sub-added extra. DEFERRABLE INITIALLY DEFERRED: priced scope cannot
  -- be deleted out from under a submission (fails at commit), while request- or
  -- tenant-level cascades that remove both sides in one transaction succeed.
  bid_scope_item_id UUID REFERENCES bid_scope_items(id) DEFERRABLE INITIALLY DEFERRED,
  description       TEXT,
  qty               NUMERIC(12,2),
  uom               TEXT CHECK (uom IN ('SY', 'LF', 'TON', 'EA', 'LS', 'HR')),
  unit_price        NUMERIC(12,2),
  extended_price    NUMERIC(14,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
  is_alternate      BOOLEAN NOT NULL DEFAULT FALSE,
  is_excluded       BOOLEAN NOT NULL DEFAULT FALSE,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_line_items_submission ON bid_line_items(bid_submission_id);
CREATE INDEX idx_bid_line_items_scope_item ON bid_line_items(bid_scope_item_id)
  WHERE bid_scope_item_id IS NOT NULL;
CREATE INDEX idx_bid_line_items_tenant     ON bid_line_items(tenant_id);

-- A line item priced against a scope item must belong to the same bid request
-- as its submission (via invitation) — otherwise the comparison board silently
-- mixes requests.
CREATE OR REPLACE FUNCTION enforce_bid_line_item_scope()
RETURNS TRIGGER AS $$
DECLARE
  item_request UUID;
  sub_request  UUID;
BEGIN
  IF NEW.bid_scope_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT bid_request_id INTO item_request
    FROM bid_scope_items WHERE id = NEW.bid_scope_item_id;
  SELECT inv.bid_request_id INTO sub_request
    FROM bid_submissions s
    JOIN bid_invitations inv ON inv.id = s.bid_invitation_id
    WHERE s.id = NEW.bid_submission_id;
  IF item_request IS DISTINCT FROM sub_request THEN
    RAISE EXCEPTION 'line item scope item belongs to a different bid request';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bid_line_items_scope
  BEFORE INSERT OR UPDATE ON bid_line_items
  FOR EACH ROW EXECUTE FUNCTION enforce_bid_line_item_scope();

-- -----------------------------------------------------------------------------
-- bid_negotiations — counter rounds and sub questions (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE bid_negotiations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_invitation_id UUID NOT NULL REFERENCES bid_invitations(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction         TEXT NOT NULL CHECK (direction IN ('to_sub', 'from_sub')),
  message           TEXT,
  target_total      NUMERIC(12,2),  -- our ask; never exposed on from_sub rows
  scope_changes     TEXT,
  new_due_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id),  -- NULL when direction = 'from_sub'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_negotiations_invitation ON bid_negotiations(bid_invitation_id, created_at);
CREATE INDEX idx_bid_negotiations_tenant     ON bid_negotiations(tenant_id);

-- -----------------------------------------------------------------------------
-- bid_events — append-only audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE bid_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bid_request_id UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  invitation_id  UUID REFERENCES bid_invitations(id) ON DELETE CASCADE,
  actor_type     TEXT NOT NULL CHECK (actor_type IN ('admin', 'sub', 'system')),
  actor_id       UUID,
  -- sent, viewed, downloaded_attachment, submitted, revised, countered,
  -- declined, reminded, awarded, lost_notice_sent, revoked, compliance_override
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_events_request    ON bid_events(bid_request_id, created_at DESC);
CREATE INDEX idx_bid_events_invitation ON bid_events(invitation_id)
  WHERE invitation_id IS NOT NULL;
CREATE INDEX idx_bid_events_tenant     ON bid_events(tenant_id);

-- =============================================================================
-- updated_at triggers
-- =============================================================================

CREATE TRIGGER trg_bid_requests_updated_at
  BEFORE UPDATE ON bid_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bid_scope_groups_updated_at
  BEFORE UPDATE ON bid_scope_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bid_scope_items_updated_at
  BEFORE UPDATE ON bid_scope_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bid_attachments_updated_at
  BEFORE UPDATE ON bid_attachments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subcontractors_updated_at
  BEFORE UPDATE ON subcontractors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sub_compliance_docs_updated_at
  BEFORE UPDATE ON sub_compliance_docs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bid_invitations_updated_at
  BEFORE UPDATE ON bid_invitations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bid_submissions_updated_at
  BEFORE UPDATE ON bid_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bid_line_items_updated_at
  BEFORE UPDATE ON bid_line_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Admin-only, tenant-scoped (spec §9). Subs have no session: sub-facing routes
-- validate the invitation token server-side and use the service key, which
-- bypasses RLS. No sub policies exist by design.

ALTER TABLE bid_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_scope_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_scope_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_attachments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_compliance_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_invitations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_negotiations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_events          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bid requests"
  ON bid_requests FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage scope groups"
  ON bid_scope_groups FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage scope items"
  ON bid_scope_items FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage bid attachments"
  ON bid_attachments FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage subcontractors"
  ON subcontractors FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage compliance docs"
  ON sub_compliance_docs FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage bid invitations"
  ON bid_invitations FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage bid submissions"
  ON bid_submissions FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage bid line items"
  ON bid_line_items FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins manage bid negotiations"
  ON bid_negotiations FOR ALL
  USING      (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- bid_events is append-only for authenticated users: SELECT + INSERT only.
-- No UPDATE or DELETE policies exist, so both are denied under RLS.
CREATE POLICY "Admins read bid events"
  ON bid_events FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

CREATE POLICY "Admins insert bid events"
  ON bid_events FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
