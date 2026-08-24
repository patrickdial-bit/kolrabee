# Profit Margin Guardrails — Phase 1 Implementation

## Overview

This system enforces three guardrails on project profitability to prevent unprofitable estimates:

1. **Painter Labor**: ≤30% of project cost
2. **Paint & Sundries**: <14% of project cost
3. **Gross Profit Margin**: >50% of project cost

The system has two workflows:
- **Estimator**: Pre-quote validation with real-time visual feedback
- **Ledger**: Post-job cost reconciliation and variance analysis

## Database Schema

### `profit_thresholds`
Tenant-level configuration for guardrail thresholds.

```sql
CREATE TABLE profit_thresholds (
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL UNIQUE
  labor_max_pct NUMERIC DEFAULT 30
  materials_max_pct NUMERIC DEFAULT 14
  min_profit_margin_pct NUMERIC DEFAULT 50
  created_at TIMESTAMP
  updated_at TIMESTAMP
)
```

**Purpose**: Centralized config per tenant. Defaults seeded on migration.

### `project_estimates`
Pre-quote guardrail snapshot for each project.

```sql
CREATE TABLE project_estimates (
  id UUID PRIMARY KEY
  project_id UUID NOT NULL UNIQUE
  paintscout_quote_id TEXT
  total_price NUMERIC NOT NULL
  estimated_hours NUMERIC NOT NULL
  crew_count INTEGER NOT NULL
  crew_rate_per_hour NUMERIC NOT NULL
  material_cost_estimate NUMERIC DEFAULT 0
  referral_fee NUMERIC DEFAULT 0
  
  -- Generated columns (auto-calculated)
  material_pct NUMERIC GENERATED ALWAYS
  labor_pct NUMERIC GENERATED ALWAYS
  projected_profit_pct NUMERIC GENERATED ALWAYS
  
  status TEXT DEFAULT 'estimating' ('estimating', 'approved', 'rejected')
  approval_reason TEXT
  
  created_at TIMESTAMP
  updated_at TIMESTAMP
  created_by UUID NOT NULL
  updated_by UUID NOT NULL
)
```

**Key Calculations**:
- `labor_pct = ((estimated_hours * crew_rate_per_hour * crew_count) / total_price) * 100`
- `material_pct = (material_cost_estimate / total_price) * 100`
- `projected_profit_pct = 100 - labor_pct - material_pct`

### `project_ledger_entries`
Post-job cost reconciliation with actual expenses.

```sql
CREATE TABLE project_ledger_entries (
  id UUID PRIMARY KEY
  project_id UUID NOT NULL
  
  actual_material_cost NUMERIC DEFAULT 0
  actual_crew_hours NUMERIC NOT NULL
  actual_crew_pay NUMERIC NOT NULL
  referral_fee NUMERIC DEFAULT 0
  
  -- Generated columns (auto-calculated)
  total_cogs NUMERIC GENERATED ALWAYS
  actual_gross_profit NUMERIC GENERATED ALWAYS
  actual_margin_pct NUMERIC GENERATED ALWAYS
  
  notes TEXT
  created_at TIMESTAMP
  updated_at TIMESTAMP
  created_by UUID NOT NULL
)
```

**Key Calculations**:
- `total_cogs = actual_material_cost + actual_crew_pay + COALESCE(referral_fee, 0)`
- `actual_gross_profit = (SELECT total_price FROM project_estimates WHERE project_id = ...) - total_cogs`
- `actual_margin_pct = (actual_gross_profit / (SELECT total_price FROM project_estimates WHERE project_id = ...)) * 100`

### `margin_checks`
Audit trail of margin validation events with status snapshots at check time.

```sql
CREATE TABLE margin_checks (
  id UUID PRIMARY KEY
  project_id UUID NOT NULL
  check_type TEXT ('estimate', 'final')
  
  labor_pct NUMERIC NOT NULL
  materials_pct NUMERIC NOT NULL
  profit_margin_pct NUMERIC NOT NULL
  
  labor_threshold NUMERIC NOT NULL
  materials_threshold NUMERIC NOT NULL
  profit_threshold NUMERIC NOT NULL
  
  status TEXT ('pass', 'warning', 'fail')
  
  checked_at TIMESTAMP
  checked_by UUID NOT NULL
)
```

## API Endpoints

### `GET /api/estimates?projectId={id}`
Fetch estimate for a project. Returns `null` if not found.

**Authorization**: Admin role required + tenant authorization

**Response**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "paintscout_quote_id": "3938",
  "total_price": 5000,
  "estimated_hours": 40,
  "crew_count": 2,
  "crew_rate_per_hour": 30,
  "material_cost_estimate": 500,
  "referral_fee": 0,
  "material_pct": 10,
  "labor_pct": 24,
  "projected_profit_pct": 66,
  "status": "estimating",
  "approval_reason": null,
  "created_at": "2026-08-24T...",
  "updated_at": "2026-08-24T...",
  "created_by": "uuid",
  "updated_by": "uuid"
}
```

### `POST /api/estimates`
Create or update estimate. Upserts by `project_id`.

**Authorization**: Admin role required + tenant authorization

**Request**:
```json
{
  "projectId": "uuid",
  "paintscoutQuoteId": "3938",
  "totalPrice": 5000,
  "estimatedHours": 40,
  "crewCount": 2,
  "crewRatePerHour": 30,
  "materialCostEstimate": 500,
  "referralFee": 0
}
```

**Response**: Full estimate object (same as GET response)

### `GET /api/ledger?projectId={id}`
Fetch ledger entry for a project. Returns `null` if not found.

**Authorization**: Admin role required + tenant authorization

**Response**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "actual_material_cost": 450,
  "actual_crew_hours": 38,
  "actual_crew_pay": 1140,
  "referral_fee": 0,
  "total_cogs": 1590,
  "actual_gross_profit": 3410,
  "actual_margin_pct": 68.2,
  "notes": "Smooth job, minimal prep",
  "created_at": "2026-08-24T...",
  "updated_at": "2026-08-24T...",
  "created_by": "uuid"
}
```

### `POST /api/ledger`
Create or update ledger entry. Upserts by `project_id`.

**Authorization**: Admin role required + tenant authorization

**Request**:
```json
{
  "projectId": "uuid",
  "actualMaterialCost": 450,
  "actualCrewHours": 38,
  "actualCrewPay": 1140,
  "referralFee": 0,
  "notes": "Smooth job, minimal prep"
}
```

**Response**: Full ledger entry object (same as GET response)

## Components

### `<MarginCalculator>`
Estimator workflow component for pre-quote validation.

**Props**:
- `projectId: string` - Project to save estimate for
- `projectValue?: number` - Initial total price (default: 0)
- `estimate?: ProjectEstimate | null` - Pre-fill from existing estimate
- `thresholds: ProfitThresholds` - Tenant threshold config
- `onSave?: (estimate: ProjectEstimate) => void` - Callback after save

**Features**:
- Live calculation of labor %, material %, and profit % as user types
- Three StatusBadge indicators (red/yellow/green) for each guardrail
- Summary section showing labor cost, COGS, and estimated gross profit
- Overall status display: "✓ Good to quote" / "⚠ Caution" / "✗ Cannot quote"
- Save button posts to `/api/estimates`
- Error display with user-friendly messages

**Guardrail Logic**:
- **Pass**: All three guardrails pass (labor ≤30%, materials <14%, profit >50%)
- **Warning**: One or more guardrails slightly exceeded
- **Fail**: Major threshold violations

### `<LedgerEntryForm>`
Post-job cost reconciliation component with variance analysis.

**Props**:
- `projectId: string` - Project to save ledger for
- `estimate?: ProjectEstimate | null` - Used for variance calculation
- `ledgerEntry?: ProjectLedgerEntry | null` - Pre-fill from existing entry
- `thresholds: ProfitThresholds` - Tenant threshold config
- `onSave?: (entry: ProjectLedgerEntry) => void` - Callback after save

**Features**:
- Input fields: actual material cost, actual crew hours, actual crew pay, referral fee, notes
- VarianceIndicator for materials (estimated vs. actual with % variance)
- VarianceIndicator for crew pay (estimated vs. actual with % variance)
- Color-coded variance display: green <5%, yellow 5-15%, red >15%
- Summary section showing actual COGS, gross profit, and margin %
- Status display reflecting final margin (meets target or below target)
- Save button posts to `/api/ledger`
- Error handling

## Integration Checklist

### Step 1: Apply Database Migration
```bash
supabase migration up
```

This creates all four tables, indexes, and seeds default thresholds for existing tenants.

### Step 2: Add Tabs to Project Detail Page
In `/app/admin/projects/[id]/ProjectDetailClient.tsx`, add two new tabs:
- **Estimate**: Renders `<MarginCalculator>` with project data
- **Ledger**: Renders `<LedgerEntryForm>` with project data

### Step 3: Load Data on Project Load
When loading project detail:
1. Fetch estimate: `GET /api/estimates?projectId={id}`
2. Fetch ledger entry: `GET /api/ledger?projectId={id}`
3. Fetch thresholds: Query `profit_thresholds` table for current tenant
4. Pass to components via props

**Example**:
```typescript
const [estimate, setEstimate] = useState<ProjectEstimate | null>(null)
const [ledger, setLedger] = useState<ProjectLedgerEntry | null>(null)
const [thresholds, setThresholds] = useState<ProfitThresholds>({...})

useEffect(() => {
  async function load() {
    const estRes = await fetch(`/api/estimates?projectId=${projectId}`)
    const est = estRes.ok ? await estRes.json() : null
    setEstimate(est)
    
    const ledRes = await fetch(`/api/ledger?projectId=${projectId}`)
    const led = ledRes.ok ? await ledRes.json() : null
    setLedger(led)
    
    // Fetch thresholds from DB
    const { data: thresh } = await adminClient
      .from('profit_thresholds')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()
    setThresholds(thresh)
  }
  load()
}, [projectId])
```

### Step 4: (Optional) Add Dashboard Warnings
Display margin violations on admin dashboard:
- Show projects with `projected_profit_pct < 50%` in project list
- Add a "Margin Warnings" dashboard card with project count and list
- Link each warning to the estimate tab

## Data Flow

### Estimator Workflow
```
1. Admin enters estimate data in MarginCalculator
   ├─ PaintScout quote ID
   ├─ Total price
   ├─ Estimated hours, crew count, crew rate/hour
   └─ Material cost estimate

2. Component calculates live:
   ├─ Labor % = (hours * rate * crew / price) * 100
   ├─ Material % = (material / price) * 100
   └─ Profit % = 100 - labor - material

3. Component displays guardrail status:
   ├─ Green: Labor ≤30%, Material <14%, Profit >50%
   ├─ Yellow: One threshold slightly exceeded
   └─ Red: Major threshold violation

4. Admin clicks Save
   └─ POST /api/estimates
      ├─ Validates project exists & belongs to tenant
      ├─ Upserts project_estimates row
      ├─ Database auto-calculates percentages
      └─ Returns full estimate with calculated fields

5. Component calls onSave callback (e.g., to show success toast)
```

### Ledger Workflow
```
1. Admin enters actual job costs in LedgerEntryForm
   ├─ Actual material cost
   ├─ Actual crew hours & pay
   ├─ Referral fee
   └─ Notes (delays, issues, etc.)

2. Component calculates variance:
   ├─ Material variance = actual - estimate
   ├─ Crew pay variance = actual - estimate
   └─ Variance % = (variance / estimate) * 100

3. Component displays variance indicators:
   ├─ Green: Variance <5%
   ├─ Yellow: Variance 5-15%
   └─ Red: Variance >15%

4. Component calculates final margin:
   ├─ COGS = actual material + crew pay + referral fee
   ├─ Gross profit = total price - COGS
   └─ Margin % = (gross profit / total price) * 100

5. Admin clicks Save
   └─ POST /api/ledger
      ├─ Validates project exists & estimate exists
      ├─ Upserts project_ledger_entries row
      ├─ Database auto-calculates margin %
      └─ Returns full ledger entry with calculated fields

6. Component displays status:
   ├─ Green: Margin ≥50%
   └─ Red: Margin <50%
```

## Future Phases

### Phase 2: QuickBooks Integration (Q4 2026)
- Sync crew rates from QB employee list
- Pull actual job costs from QB expenses (tagged by project)
- Auto-populate ledger from QB invoice line items
- Two-way sync: update QB when margin check status changes

**Tools**: Zapier QB connector for read/write

### Phase 3: Dashboard Analytics (Q1 2027)
- Variance trend analysis (estimate vs. actual over time)
- Crew performance metrics (labor variance by crew)
- Material cost tracking and supplier variance
- Margin by project type and season
- Threshold violation alerts and notifications

### Phase 4: Crew Rates Management (Q2 2027)
- Crew rate table (hourly rates by painter/crew)
- Rate card history (track rate changes over time)
- Estimate labor cost pre-fill from crew rates
- Crew availability calendar
- Crew skill/specialty tags for better rate estimation

## Notes

- All calculated fields use SQL GENERATED columns for consistency across API and UI
- `actual_crew_hours` is tracked for future Phase 2 QB integration but not currently used in margin calculation
- Referral fees are tracked separately but included in COGS and margin calculation
- Status field on estimates (`estimating`/`approved`/`rejected`) is reserved for future approval workflow
- Margin checks table is seeded on save (POST endpoints will audit margin check events in Phase 2)
