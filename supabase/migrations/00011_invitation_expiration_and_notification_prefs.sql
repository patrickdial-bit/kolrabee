-- Add invitation expiration and notification preferences
-- V2 features: invitation expiration + notification preferences

-- 1. Add expires_at to project_invitations
ALTER TABLE project_invitations
  ADD COLUMN expires_at TIMESTAMPTZ;

-- Backfill existing project invitations (7 days from invited_at)
UPDATE project_invitations
  SET expires_at = invited_at + INTERVAL '7 days'
  WHERE expires_at IS NULL;

-- Set default for future rows
ALTER TABLE project_invitations
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '7 days';

-- 2. Add expires_at to platform_invites
ALTER TABLE platform_invites
  ADD COLUMN expires_at TIMESTAMPTZ;

-- Backfill existing platform invites (30 days from invited_at)
UPDATE platform_invites
  SET expires_at = invited_at + INTERVAL '30 days'
  WHERE expires_at IS NULL;

-- Set default for future rows
ALTER TABLE platform_invites
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '30 days';

-- 3. Add notification_preferences JSONB to users
ALTER TABLE users
  ADD COLUMN notification_preferences JSONB DEFAULT '{"project_invites": true, "project_updates": true, "project_accepted": true, "project_cancelled": true}'::jsonb;
