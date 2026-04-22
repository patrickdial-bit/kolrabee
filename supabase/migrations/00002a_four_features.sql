-- ============================================================================
-- Migration: Four Features
-- 1. Sub Ratings
-- 2. File Attachments on Job Posts
-- 3. Job Thread Messaging
-- 4. Job Completion Confirmation
-- ============================================================================

-- =============================================================================
-- 1. JOB COMPLETION CONFIRMATION — new status + columns on projects
-- =============================================================================

-- Add pending_completion to the status check constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('available', 'accepted', 'pending_completion', 'completed', 'paid', 'cancelled'));

-- Add completion request tracking columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'completion_requested_by') THEN
    ALTER TABLE projects ADD COLUMN completion_requested_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'completion_requested_at') THEN
    ALTER TABLE projects ADD COLUMN completion_requested_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================================================
-- 2. SUB RATINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS sub_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES users(id),
  rated_by UUID NOT NULL REFERENCES users(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_ratings_tenant_sub ON sub_ratings(tenant_id, subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sub_ratings_project ON sub_ratings(project_id);

ALTER TABLE sub_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert ratings" ON sub_ratings;
CREATE POLICY "Admins can insert ratings"
  ON sub_ratings FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Admins can select ratings" ON sub_ratings;
CREATE POLICY "Admins can select ratings"
  ON sub_ratings FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Subs can read own ratings" ON sub_ratings;
CREATE POLICY "Subs can read own ratings"
  ON sub_ratings FOR SELECT
  USING (subcontractor_id = auth_user_id());

-- =============================================================================
-- 3. FILE ATTACHMENTS ON JOB POSTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  file_type VARCHAR(50),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_attachments_project ON project_attachments(project_id);

ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage attachments" ON project_attachments;
CREATE POLICY "Admins can manage attachments"
  ON project_attachments FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Subs can read project attachments" ON project_attachments;
CREATE POLICY "Subs can read project attachments"
  ON project_attachments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
    AND (
      project_id IN (SELECT project_id FROM project_invitations WHERE subcontractor_id = auth_user_id())
      OR project_id IN (SELECT id FROM projects WHERE accepted_by = auth_user_id())
    )
  );

-- =============================================================================
-- 4. JOB THREAD MESSAGING
-- =============================================================================

CREATE TABLE IF NOT EXISTS job_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_messages_project_created ON job_messages(project_id, created_at);

ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage messages" ON job_messages;
CREATE POLICY "Admins can manage messages"
  ON job_messages FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "Subs can read project messages" ON job_messages;
CREATE POLICY "Subs can read project messages"
  ON job_messages FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
    AND project_id IN (SELECT id FROM projects WHERE accepted_by = auth_user_id())
  );

DROP POLICY IF EXISTS "Subs can insert project messages" ON job_messages;
CREATE POLICY "Subs can insert project messages"
  ON job_messages FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
    AND sender_id = auth_user_id()
    AND project_id IN (SELECT id FROM projects WHERE accepted_by = auth_user_id())
  );

-- =============================================================================
-- Add notification_preferences columns for new features
-- =============================================================================

-- notification_preferences JSON field on users already exists; we'll handle
-- new keys (new_message, project_completion_requested, project_completion_approved)
-- at the application level with defaults.
