-- Job mapping: store geocoded coordinates for each project so the admin and
-- subcontractor map views can plot jobs without re-geocoding on every load.
-- Coordinates are derived from the project address (see lib/geocode.ts) and
-- refreshed whenever the address changes. geocoded_at records the last attempt.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
