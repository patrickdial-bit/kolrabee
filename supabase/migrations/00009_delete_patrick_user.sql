-- Delete the tenant and user created via regular signup for this email
-- Must delete user first (FK), then tenant, then auth user

DO $$
DECLARE
  _auth_id UUID;
  _user_id UUID;
  _tenant_id UUID;
BEGIN
  -- Find the auth user
  SELECT id INTO _auth_id FROM auth.users WHERE email = 'patrick.dial@midwest-investments.com';

  IF _auth_id IS NULL THEN
    RAISE NOTICE 'No auth user found, skipping.';
    RETURN;
  END IF;

  -- Find the app user
  SELECT id, tenant_id INTO _user_id, _tenant_id FROM users WHERE supabase_auth_id = _auth_id;

  -- Delete project invitations for this tenant
  DELETE FROM project_invitations WHERE tenant_id = _tenant_id;

  -- Delete projects for this tenant
  DELETE FROM projects WHERE tenant_id = _tenant_id;

  -- Delete platform invites for this tenant
  DELETE FROM platform_invites WHERE tenant_id = _tenant_id;

  -- Delete super_admins record if exists
  DELETE FROM super_admins WHERE supabase_auth_id = _auth_id;

  -- Delete the app user
  DELETE FROM users WHERE id = _user_id;

  -- Delete the tenant
  DELETE FROM tenants WHERE id = _tenant_id;

  -- Delete the auth user
  DELETE FROM auth.users WHERE id = _auth_id;

  RAISE NOTICE 'Deleted user, tenant, and auth record for patrick.dial@midwest-investments.com';
END $$;
