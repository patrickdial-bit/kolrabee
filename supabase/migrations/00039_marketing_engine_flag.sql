-- 00039: Marketing engine is a separate rollout — per-tenant flag, enabled
-- only by the platform owner (super-admin). Default OFF for everyone.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE;
