-- Deactivating a subcontractor.
--
-- Adds an 'inactive' user status so an admin can take a subcontractor off the
-- roster without deleting them. Inactive subs keep their profile, documents and
-- job history, but are excluded from dispatch lists so they can never be sent a
-- job invite by accident. Only 'active' subs count against the plan limit, so a
-- deactivated sub frees up a seat until they are reactivated.
--
--   active   — normal; appears in invite lists, counts against the plan limit
--   inactive — off the roster; no invites, no seat, fully reversible
--   deleted  — soft-deleted; also blocked from signing in
--
-- Numbered 00042 to match the migration already recorded on the production and
-- preview databases, and to leave 00040/00041 free for the bid-board branch.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel     ON rel.oid = con.conrelid
    JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'users'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'inactive', 'deleted'));

-- Dispatch lists and plan-limit counts all filter on (tenant_id, role, status).
CREATE INDEX IF NOT EXISTS idx_users_tenant_role_status
  ON public.users (tenant_id, role, status);
