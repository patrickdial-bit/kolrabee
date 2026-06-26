-- Grant the Painter1 tenant unlimited usage.
-- In this codebase, a value of -1 for max_projects / max_subcontractors disables
-- limit enforcement (see PLAN_LIMITS in lib/types.ts and the >= 0 checks in the
-- project/subcontractor server actions), which the UI renders as "Unlimited".
-- The plan is left unchanged (no billing impact); only the limits are lifted.

UPDATE tenants
SET max_projects = -1,
    max_subcontractors = -1
WHERE slug = 'painter1-vf1e';
