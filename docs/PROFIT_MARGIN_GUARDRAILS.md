# Profit Margin Guardrails — Phase 1 Implementation

**Date:** 2026-08-24  
**Status:** Implementation complete, ready for integration  
**Scope:** Estimator margin calculator + post-job ledger tracking

## What Was Built

### 1. Database Schema (Migration 00045)
- `profit_thresholds` — tenant-level guardrail config (labor ≤30%, materials <14%, profit >50%)
- `project_estimates` — pre-quote margin calculations with live percentage tracking
- `project_ledger_entries` — post-job actual costs and final margin reconciliation
- `margin_checks` — audit trail of all margin decisions (estimate + final)

### 2. API Endpoints
- `POST/GET /api/estimates?projectId=X` — create/fetch estimate with auto-calculated percentages
- `POST/GET /api/ledger?projectId=X` — create/fetch ledger entry with actual costs and margin

### 3. React Components
- `MarginCalculator` — live estimator form with guardrail warnings
  - Input: total price, hours, crew count/rate, material cost
  - Output: red/yellow/green status for each threshold
  - Save: upserts to `project_estimates`

- `LedgerEntryForm` — post-job cost reconciliation
  - Input: actual material cost, crew hours, crew pay, referral fee
  - Output: variance analysis vs. estimate + actual margin %
  - Save: upserts to `project_ledger_entries`

### 4. Type Definitions
- `ProjectEstimate`, `ProjectLedgerEntry`, `ProfitThresholds`, `MarginCheck`
- Helper: `getMarginStatus()` — determines pass/warning/fail based on thresholds

## Integration Checklist

### Step 1: Apply Migration
```bash
supabase migration up
# or manually run: supabase/migrations/00045_profit_margin_guardrails.sql
```

### Step 2: Add Tabs to Project Detail
On `/admin/projects/[id]/ProjectDetailClient.tsx`, add two new tabs:

```tsx
<Tab label="Estimate" value="estimate">
  <MarginCalculator
    projectId={projectId}
    projectValue={project.value}
    estimate={estimate}
    thresholds={thresholds}
    onSave={refreshEstimate}
  />
</Tab>

<Tab label="Ledger" value="ledger">
  <LedgerEntryForm
    projectId={projectId}
    estimate={estimate}
    ledgerEntry={ledgerEntry}
    thresholds={thresholds}
    onSave={refreshLedger}
  />
</Tab>
```

### Step 3: Fetch Data on Project Load
```tsx
// In getProject action or server component
const estimate = await adminClient
  .from('project_estimates')
  .select('*')
  .eq('project_id', projectId)
  .single()

const ledger = await adminClient
  .from('project_ledger_entries')
  .select('*')
  .eq('project_id', projectId)
  .single()

const thresholds = await adminClient
  .from('profit_thresholds')
  .select('*')
  .eq('tenant_id', tenantId)
  .single()
```

### Step 4 (Optional): Dashboard Warnings
Add a "Margin Violations" card to `/admin/dashboard`:

```tsx
// Query for projects below 50% profit or above 30% labor
const violations = await adminClient
  .from('margin_checks')
  .select('*')
  .eq('status', 'fail')
  .eq('check_type', 'final')
  .order('checked_at', { ascending: false })
  .limit(10)
```

## Data Flow

### Estimating Workflow
```
1. Admin opens project detail → "Estimate" tab
2. Enters: total price, hours, crew count/rate, material estimate
3. Component calculates labor%, materials%, profit%
4. Red/yellow/green status shown for each threshold
5. "Save Estimate" → POST /api/estimates
6. Upserted to project_estimates table
```

### Post-Job Workflow
```
1. Job marked complete → "Ledger" tab becomes available
2. Enter: actual material, crew hours, crew pay, referral fee
3. Component shows variance vs. estimate
4. Final margin% calculated
5. "Save Ledger" → POST /api/ledger
6. Upserted to project_ledger_entries table
```

## Future Phases

### Phase 2: QuickBooks Sync
- Zapier webhook when QB expense created → auto-fill material cost
- Webhook when QB payment logged → auto-populate crew pay

### Phase 3: Dashboard Analytics
- Monthly margin trends vs. thresholds
- By-crew profitability breakdown
- Estimator accuracy tracking (estimate vs. actual)

### Phase 4: Crew Rates Management
- Reference table for crew member hourly rates
- Sync from QB or manual entry
- Rate history for variance analysis

## Notes

- Thresholds are per-tenant, seeded to Painter1's 30/14/50 defaults
- All margin checks logged for audit trail
- Calculations are generated columns (single source of truth)
- No hard blocks yet — status is visual feedback only
- Can add hard block ("Cannot quote if fail") in Step 2 if desired

## Files Created

- `supabase/migrations/00045_profit_margin_guardrails.sql`
- `lib/types.ts` (types added)
- `app/api/estimates/route.ts`
- `app/api/ledger/route.ts`
- `components/MarginCalculator.tsx`
- `components/LedgerEntryForm.tsx`

---

Ready to integrate into project detail pages. Start with Step 1 (migration), then Step 2 (tab integration).
