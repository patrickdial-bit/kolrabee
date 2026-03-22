-- Super admin table — platform-level access
CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS — only accessed via service role client
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
