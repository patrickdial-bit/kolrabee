-- Rename plan values: starter → growth, pro → operator
-- Must drop and recreate the constraint since CHECK constraints don't support ALTER

-- Update existing data first
UPDATE tenants SET plan = 'growth' WHERE plan = 'starter';
UPDATE tenants SET plan = 'operator' WHERE plan = 'pro';

-- Drop old constraint and add new one
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'trial', 'growth', 'operator', 'cancelled'));
