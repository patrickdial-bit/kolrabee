-- Distinguish admin vs subcontractor invites in platform_invites.
-- Existing rows are all subcontractor invites, which matches the default.
ALTER TABLE platform_invites
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'subcontractor'
    CHECK (role IN ('admin', 'subcontractor'));
