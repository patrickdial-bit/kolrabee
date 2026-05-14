-- Make project FK relations cascade on delete so admins can hard-delete a project.
-- Without this, project_invitations/job_messages/message_reads/project_attachments/
-- sub_ratings keep RESTRICT semantics and any deletion errors with FK violations.
--
-- Each block guards on information_schema.tables so the migration is idempotent
-- against preview branches where letter-suffixed migrations (e.g. 00002a) aren't
-- applied and some of these tables don't exist yet. On prod every table exists
-- and the DROP/ADD pair runs as originally intended.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_invitations') THEN
    ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_project_id_fkey;
    ALTER TABLE project_invitations
      ADD CONSTRAINT project_invitations_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_messages') THEN
    ALTER TABLE job_messages DROP CONSTRAINT IF EXISTS job_messages_project_id_fkey;
    ALTER TABLE job_messages
      ADD CONSTRAINT job_messages_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_reads') THEN
    ALTER TABLE message_reads DROP CONSTRAINT IF EXISTS message_reads_project_id_fkey;
    ALTER TABLE message_reads
      ADD CONSTRAINT message_reads_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_attachments') THEN
    ALTER TABLE project_attachments DROP CONSTRAINT IF EXISTS project_attachments_project_id_fkey;
    ALTER TABLE project_attachments
      ADD CONSTRAINT project_attachments_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sub_ratings') THEN
    ALTER TABLE sub_ratings DROP CONSTRAINT IF EXISTS sub_ratings_project_id_fkey;
    ALTER TABLE sub_ratings
      ADD CONSTRAINT sub_ratings_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;
