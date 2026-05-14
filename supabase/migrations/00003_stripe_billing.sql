-- Migration: Add Stripe billing fields to tenants table

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'pro', 'cancelled')),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS max_projects INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_subcontractors INT DEFAULT 5;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
