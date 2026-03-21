-- Migration: Add 'free' plan option to tenants table

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'trial', 'starter', 'pro', 'cancelled'));

-- Update default plan for new tenants to 'free'
ALTER TABLE tenants
  ALTER COLUMN plan SET DEFAULT 'free';

-- Update default limits to match free tier
ALTER TABLE tenants
  ALTER COLUMN max_projects SET DEFAULT 3,
  ALTER COLUMN max_subcontractors SET DEFAULT 1;
