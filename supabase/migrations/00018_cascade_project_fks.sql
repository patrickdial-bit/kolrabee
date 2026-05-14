-- Make project FK relations cascade on delete so admins can hard-delete a project.
-- Without this, project_invitations/job_messages/message_reads/project_attachments/
-- sub_ratings keep RESTRICT semantics and any deletion errors with FK violations.

ALTER TABLE project_invitations DROP CONSTRAINT project_invitations_project_id_fkey;
ALTER TABLE project_invitations
  ADD CONSTRAINT project_invitations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE job_messages DROP CONSTRAINT job_messages_project_id_fkey;
ALTER TABLE job_messages
  ADD CONSTRAINT job_messages_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE message_reads DROP CONSTRAINT message_reads_project_id_fkey;
ALTER TABLE message_reads
  ADD CONSTRAINT message_reads_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE project_attachments DROP CONSTRAINT project_attachments_project_id_fkey;
ALTER TABLE project_attachments
  ADD CONSTRAINT project_attachments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE sub_ratings DROP CONSTRAINT sub_ratings_project_id_fkey;
ALTER TABLE sub_ratings
  ADD CONSTRAINT sub_ratings_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
