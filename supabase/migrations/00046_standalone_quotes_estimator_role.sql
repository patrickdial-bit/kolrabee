-- Standalone quotes + estimator role.
--
-- The guardrail calculator has to run BEFORE the contract is sent, but
-- projects are only created by the admin AFTER the customer signs. So a
-- quote can no longer require a project: estimators (a new, limited role
-- with their own logins) create quotes against just a customer name, and
-- the admin links the winning quote to the project once it exists.

-- 1. Allow the new role. Estimators see only their own quotes — no project,
--    payout, or team access.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'subcontractor', 'estimator'));

ALTER TABLE platform_invites DROP CONSTRAINT IF EXISTS platform_invites_role_check;
ALTER TABLE platform_invites ADD CONSTRAINT platform_invites_role_check
  CHECK (role IN ('admin', 'subcontractor', 'estimator'));

-- 2. Detach quotes from projects. project_id stays UNIQUE (a project has at
--    most one estimate; multiple NULLs are allowed) but is no longer required.
--    A quote must identify SOMETHING — a project or a customer.
ALTER TABLE project_estimates ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE project_estimates ADD COLUMN customer_name TEXT;
ALTER TABLE project_estimates ADD COLUMN customer_address TEXT;
ALTER TABLE project_estimates ADD CONSTRAINT project_estimates_subject_check
  CHECK (project_id IS NOT NULL OR customer_name IS NOT NULL);

CREATE INDEX idx_project_estimates_created_by ON project_estimates(created_by);

-- 3. RLS for estimators: manage only quotes they created, and read the
--    tenant thresholds so the guardrail badges can render. Everything else
--    (ledger, margin checks, projects) stays admin-only.
CREATE POLICY "Estimators can manage their own estimates"
  ON project_estimates FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'estimator' AND created_by = auth_user_id())
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'estimator' AND created_by = auth_user_id());

CREATE POLICY "Estimators can read profit thresholds"
  ON profit_thresholds FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'estimator');
