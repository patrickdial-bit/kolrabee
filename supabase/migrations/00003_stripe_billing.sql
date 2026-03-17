-- Migration: Add Stripe billing fields to tenants table

ALTER TABLE tenants
  ADD COLUMN stripe_customer_id VARCHAR(255),
  ADD COLUMN stripe_subscription_id VARCHAR(255),
  ADD COLUMN plan VARCHAR(20) DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'pro', 'cancelled')),
  ADD COLUMN trial_ends_at TIMESTAMPTZ,
  ADD COLUMN billing_email VARCHAR(255),
  ADD COLUMN max_projects INT DEFAULT 10,
  ADD COLUMN max_subcontractors INT DEFAULT 5;

CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id);
