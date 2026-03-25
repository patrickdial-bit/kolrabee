-- Add 'in_progress' to the project status check constraint
-- This allows subcontractors to mark accepted jobs as in progress

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('available', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'));
