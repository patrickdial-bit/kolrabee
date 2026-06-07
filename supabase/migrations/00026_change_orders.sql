-- Change orders — let admins adjust scope and pay on a project at any point
-- without confusion. Rather than silently overwriting a project's payout, every
-- adjustment is recorded as a dated, attributed line item with a description of
-- the scope change. The project's payout_amount remains the live running total
-- (so YTD / paid math is unchanged); change_orders is the audit trail that
-- explains how the payout got there.
--
-- amount:           the signed delta applied to the payout (+ adds scope/pay,
--                   - reduces it).
-- previous_payout:  the project payout immediately before this change order.
-- new_payout:       the project payout immediately after (previous + amount).
-- description:      what changed in scope — required so there is no confusion.

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  previous_payout DECIMAL(12,2) NOT NULL,
  new_payout DECIMAL(12,2) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project_created ON change_orders(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_change_orders_tenant ON change_orders(tenant_id);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- Admins fully manage change orders within their tenant.
DROP POLICY IF EXISTS "Admins can manage change orders" ON change_orders;
CREATE POLICY "Admins can manage change orders"
  ON change_orders FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- The assigned subcontractor can read the change orders for their own job so the
-- pay history is transparent.
DROP POLICY IF EXISTS "Subs can read project change orders" ON change_orders;
CREATE POLICY "Subs can read project change orders"
  ON change_orders FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'subcontractor'
    AND project_id IN (SELECT id FROM projects WHERE accepted_by = auth_user_id())
  );
