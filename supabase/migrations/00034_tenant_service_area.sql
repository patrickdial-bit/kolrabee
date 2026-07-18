-- =============================================================================
-- 00034: Tenant service area
-- Free-text home market for each tenant (e.g. "Columbus, OH"). Used as a
-- geocoding hint for job addresses that lack a zip code — a bare street line
-- like "68 Parkdale Dr" otherwise resolves to the first same-named street
-- anywhere in the US — and as the map fallback area for jobs whose addresses
-- can't be pinpointed at all.
-- =============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_area VARCHAR(120);

-- Existing tenants all operate in the Columbus, Ohio market.
UPDATE tenants SET service_area = 'Columbus, OH' WHERE service_area IS NULL;
