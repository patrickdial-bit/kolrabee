-- Delete test tenants and all associated data
-- Targets: painter1-d967, painter1-w076, painter1-vlyq, zach-m-cn6w, jpdial-painting-gft4

DO $$
DECLARE
  _tenant_ids UUID[];
  _auth_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO _tenant_ids
  FROM tenants
  WHERE slug IN (
    'painter1-d967',
    'painter1-w076',
    'painter1-vlyq',
    'zach-m-cn6w',
    'jpdial-painting-gft4'
  );

  IF _tenant_ids IS NULL OR array_length(_tenant_ids, 1) = 0 THEN
    RAISE NOTICE 'No matching tenants found, skipping.';
    RETURN;
  END IF;

  SELECT array_agg(supabase_auth_id) INTO _auth_ids
  FROM users
  WHERE tenant_id = ANY(_tenant_ids) AND supabase_auth_id IS NOT NULL;

  DELETE FROM message_reads
  WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ANY(_tenant_ids));

  DELETE FROM time_entries WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM sub_ratings WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM subcontractor_settings WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM crew_members WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM job_messages WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM project_attachments WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM project_invitations WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM projects WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM platform_invites WHERE tenant_id = ANY(_tenant_ids);

  IF _auth_ids IS NOT NULL THEN
    DELETE FROM super_admins WHERE supabase_auth_id = ANY(_auth_ids);
  END IF;

  -- Break the circular FK (tenants.owner_user_id -> users.id) before deleting users
  UPDATE tenants SET owner_user_id = NULL WHERE id = ANY(_tenant_ids);

  DELETE FROM users WHERE tenant_id = ANY(_tenant_ids);
  DELETE FROM tenants WHERE id = ANY(_tenant_ids);

  IF _auth_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(_auth_ids);
  END IF;

  RAISE NOTICE 'Deleted % tenants and % auth users',
    array_length(_tenant_ids, 1),
    COALESCE(array_length(_auth_ids, 1), 0);
END $$;
