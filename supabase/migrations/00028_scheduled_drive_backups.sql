-- Scheduled (nightly) Drive backups. Adds an opt-out toggle and a selector
-- function the cron uses to find jobs with new files since their last backup.
--
-- auto_backup: connecting a drive is the opt-in (the Backup page promises
-- automatic backups), so this defaults TRUE and existing connected tenants are
-- backfilled to TRUE. It exists only as an escape hatch for tenants who want
-- manual-only backups.

ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS auto_backup BOOLEAN NOT NULL DEFAULT TRUE;

-- Returns jobs (across all connected, auto-backup-enabled tenants) that have a
-- photo or document created after their last backup — i.e. need backing up.
-- Oldest last_backup_at first (nulls first) so never-backed-up jobs go first and
-- the nightly cadence works through the backlog. Service-role only.
-- plpgsql (not sql) so the body is parsed at first call, not at CREATE time.
-- This keeps the migration resilient where a referenced table isn't present at
-- apply time (e.g. an incremental preview branch); on the real DB the tables
-- exist and the query runs normally.
CREATE OR REPLACE FUNCTION projects_needing_backup(p_limit INT DEFAULT 10)
RETURNS TABLE (project_id UUID, tenant_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.tenant_id
  FROM projects p
  JOIN tenant_integrations ti
    ON ti.tenant_id = p.tenant_id
   AND ti.provider = 'google_drive'
   AND ti.status = 'connected'
   AND ti.auto_backup = TRUE
  WHERE p.status <> 'imported'
    AND (
      EXISTS (
        SELECT 1 FROM photos ph
        WHERE ph.project_id = p.id
          AND (p.last_backup_at IS NULL OR ph.created_at > p.last_backup_at)
      )
      OR EXISTS (
        SELECT 1 FROM project_attachments pa
        WHERE pa.project_id = p.id
          AND (p.last_backup_at IS NULL OR pa.created_at > p.last_backup_at)
      )
    )
  ORDER BY p.last_backup_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;

-- Keep this off the public PostgREST surface — the cron calls it via the
-- service-role client, which bypasses these grants.
REVOKE ALL ON FUNCTION projects_needing_backup(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION projects_needing_backup(INT) FROM anon;
REVOKE ALL ON FUNCTION projects_needing_backup(INT) FROM authenticated;
