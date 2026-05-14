-- Prevent duplicate projects with the same job_number within a tenant.
-- Cancelled projects are excluded so a job_number can be reused after cancellation.

-- Step 1: cancel the newest entry of any existing duplicate group so the
-- unique index can be created. Oldest row (by created_at) wins.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, lower(job_number)
           ORDER BY created_at
         ) AS rn
  FROM projects
  WHERE job_number IS NOT NULL
    AND status <> 'cancelled'
)
UPDATE projects p
SET status = 'cancelled'
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_tenant_job_number_active
  ON projects (tenant_id, lower(job_number))
  WHERE job_number IS NOT NULL AND status <> 'cancelled';
