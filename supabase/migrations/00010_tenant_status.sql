-- Add status column to tenants for suspend/delete
ALTER TABLE tenants
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'deleted'));
