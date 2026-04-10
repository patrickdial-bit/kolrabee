-- Allow fractional estimated labor hours (e.g. 32.06)
ALTER TABLE projects
  ALTER COLUMN estimated_labor_hours TYPE NUMERIC(7,2)
  USING estimated_labor_hours::NUMERIC(7,2);
