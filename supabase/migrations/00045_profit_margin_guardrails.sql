-- Profit margin calculator guardrails for estimating
-- Tracks thresholds (labor ≤30%, materials <14%, profit >50%) and estimates/ledger

-- Tenant-level threshold config
CREATE TABLE profit_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  labor_max_pct NUMERIC NOT NULL DEFAULT 30,
  materials_max_pct NUMERIC NOT NULL DEFAULT 14,
  min_profit_margin_pct NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Pre-estimate guardrails (estimator workflow)
CREATE TABLE project_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  paintscout_quote_id TEXT,
  total_price NUMERIC NOT NULL,
  estimated_hours NUMERIC NOT NULL,
  crew_count INTEGER NOT NULL CHECK (crew_count > 0),
  crew_rate_per_hour NUMERIC NOT NULL,
  material_cost_estimate NUMERIC DEFAULT 0,
  referral_fee NUMERIC DEFAULT 0,

  -- Calculated percentages
  material_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_price > 0
      THEN (material_cost_estimate / total_price) * 100
      ELSE 0
    END
  ) STORED,

  labor_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_price > 0
      THEN ((estimated_hours * crew_rate_per_hour * crew_count) / total_price) * 100
      ELSE 0
    END
  ) STORED,

  projected_profit_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_price > 0
      THEN 100 - ((material_cost_estimate + (estimated_hours * crew_rate_per_hour * crew_count)) / total_price) * 100
      ELSE 0
    END
  ) STORED,

  -- Guardrail status
  status TEXT NOT NULL DEFAULT 'estimating' CHECK (status IN ('estimating', 'approved', 'rejected')),
  approval_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

-- Post-job ledger entry
CREATE TABLE project_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Actual costs
  actual_material_cost NUMERIC NOT NULL DEFAULT 0,
  actual_crew_hours NUMERIC NOT NULL,
  actual_crew_pay NUMERIC NOT NULL,
  referral_fee NUMERIC DEFAULT 0,

  -- Calculated actual margin
  total_cogs NUMERIC GENERATED ALWAYS AS (
    actual_material_cost + actual_crew_pay + COALESCE(referral_fee, 0)
  ) STORED,

  actual_gross_profit NUMERIC GENERATED ALWAYS AS (
    (SELECT total_price FROM project_estimates WHERE project_id = project_ledger_entries.project_id)
    - (actual_material_cost + actual_crew_pay + COALESCE(referral_fee, 0))
  ) STORED,

  actual_margin_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN (SELECT total_price FROM project_estimates WHERE project_id = project_ledger_entries.project_id) > 0
      THEN (((SELECT total_price FROM project_estimates WHERE project_id = project_ledger_entries.project_id)
             - (actual_material_cost + actual_crew_pay + COALESCE(referral_fee, 0)))
            / (SELECT total_price FROM project_estimates WHERE project_id = project_ledger_entries.project_id)) * 100
      ELSE 0
    END
  ) STORED,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

-- Audit trail for margin checks (estimating + final)
CREATE TABLE margin_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('estimate', 'final')),

  labor_pct NUMERIC NOT NULL,
  materials_pct NUMERIC NOT NULL,
  profit_margin_pct NUMERIC NOT NULL,

  -- Against threshold at time of check
  labor_threshold NUMERIC NOT NULL,
  materials_threshold NUMERIC NOT NULL,
  profit_threshold NUMERIC NOT NULL,

  -- Pass/warn/fail
  status TEXT NOT NULL CHECK (status IN ('pass', 'warning', 'fail')),

  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  checked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_project_estimates_project_id ON project_estimates(project_id);
CREATE INDEX idx_project_estimates_status ON project_estimates(status);
CREATE INDEX idx_project_ledger_entries_project_id ON project_ledger_entries(project_id);
CREATE INDEX idx_margin_checks_project_id ON margin_checks(project_id);
CREATE INDEX idx_margin_checks_check_type ON margin_checks(check_type);
CREATE INDEX idx_profit_thresholds_tenant_id ON profit_thresholds(tenant_id);

-- Seed default thresholds for existing tenants
INSERT INTO profit_thresholds (tenant_id, labor_max_pct, materials_max_pct, min_profit_margin_pct)
SELECT id, 30, 14, 50 FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
