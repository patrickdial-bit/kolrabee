-- Seed super admin: Patrick Dial
INSERT INTO super_admins (supabase_auth_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'patrick.dial@midwest-investments.com'
ON CONFLICT (supabase_auth_id) DO NOTHING;
