-- TradeTap MVP Schema
-- 4 tables: tenants, users, projects, project_invitations

-- =============================================================================
-- TABLES
-- =============================================================================

-- TENANTS (each company using TradeTap)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_user_id UUID,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS (admins and subcontractors)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'subcontractor')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- PROJECTS (jobs posted by admin)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID NOT NULL REFERENCES users(id),
  job_number VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  start_date DATE,
  payout_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
    'available',
    'accepted',
    'completed',
    'paid',
    'cancelled'
  )),
  companycam_link TEXT,
  notes TEXT,
  admin_notes TEXT,
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROJECT INVITATIONS
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, subcontractor_id)
);

-- Add FK from tenants.owner_user_id to users after users table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenants_owner'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT fk_tenants_owner FOREIGN KEY (owner_user_id) REFERENCES users(id);
  END IF;
END $$;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth ON users(supabase_auth_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_accepted_by ON projects(accepted_by);
CREATE INDEX IF NOT EXISTS idx_invitations_sub ON project_invitations(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_invitations_project ON project_invitations(project_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's tenant_id from the users table
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get the current user's role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get the current user's app-level id
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get the current user's status
CREATE OR REPLACE FUNCTION auth_user_status()
RETURNS TEXT AS $$
  SELECT status FROM users WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own tenant" ON tenants;
CREATE POLICY "Users can read own tenant"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id());

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read tenant members" ON users;
CREATE POLICY "Users can read tenant members"
  ON users FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  USING (supabase_auth_id = auth.uid())
  WITH CHECK (supabase_auth_id = auth.uid());

-- Admins can update users in their tenant (for soft delete)
DROP POLICY IF EXISTS "Admins can update tenant users" ON users;
CREATE POLICY "Admins can update tenant users"
  ON users FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Allow inserts (service role will handle signup)
DROP POLICY IF EXISTS "Allow insert for signup" ON users;
CREATE POLICY "Allow insert for signup"
  ON users FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
-- Admins: full CRUD on tenant projects
DROP POLICY IF EXISTS "Admins can select projects" ON projects;
CREATE POLICY "Admins can select projects"
  ON projects FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update projects" ON projects;
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Subs: can see projects they're invited to or accepted
DROP POLICY IF EXISTS "Subs can see invited projects" ON projects;
CREATE POLICY "Subs can see invited projects"
  ON projects FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
    AND (
      -- Projects they've been invited to
      id IN (SELECT project_id FROM project_invitations WHERE subcontractor_id = auth_user_id())
      -- Projects they've accepted
      OR accepted_by = auth_user_id()
    )
  );

-- Subs can update projects (for accepting)
DROP POLICY IF EXISTS "Subs can update available projects" ON projects;
CREATE POLICY "Subs can update available projects"
  ON projects FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
    AND (
      status = 'available'
      OR accepted_by = auth_user_id()
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
  );

-- -----------------------------------------------------------------------------
-- project_invitations
-- -----------------------------------------------------------------------------
-- Admins: full CRUD
DROP POLICY IF EXISTS "Admins can select invitations" ON project_invitations;
CREATE POLICY "Admins can select invitations"
  ON project_invitations FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can insert invitations" ON project_invitations;
CREATE POLICY "Admins can insert invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update invitations" ON project_invitations;
CREATE POLICY "Admins can update invitations"
  ON project_invitations FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can delete invitations" ON project_invitations;
CREATE POLICY "Admins can delete invitations"
  ON project_invitations FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Subs can see their own invitations
DROP POLICY IF EXISTS "Subs can see own invitations" ON project_invitations;
CREATE POLICY "Subs can see own invitations"
  ON project_invitations FOR SELECT
  USING (subcontractor_id = auth_user_id());

-- Subs can update their own invitations (accept/decline)
DROP POLICY IF EXISTS "Subs can update own invitations" ON project_invitations;
CREATE POLICY "Subs can update own invitations"
  ON project_invitations FOR UPDATE
  USING (subcontractor_id = auth_user_id())
  WITH CHECK (subcontractor_id = auth_user_id());
