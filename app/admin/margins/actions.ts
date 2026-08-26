'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ThresholdRanges } from '@/lib/types'

// Company-level guardrail settings. One row per tenant — every quote,
// estimate, and ledger check across all jobs reads these ranges.
export async function updateProfitThresholds(ranges: ThresholdRanges) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const pairs: Array<[label: string, floor: number, ceiling: number]> = [
    ['Labor', ranges.labor_min_pct, ranges.labor_max_pct],
    ['Materials', ranges.materials_min_pct, ranges.materials_max_pct],
    ['Profit', ranges.min_profit_margin_pct, ranges.profit_max_pct],
  ]
  for (const [label, floor, ceiling] of pairs) {
    if (
      typeof floor !== 'number' || typeof ceiling !== 'number' ||
      Number.isNaN(floor) || Number.isNaN(ceiling) ||
      floor < 0 || ceiling > 100
    ) {
      return { error: `${label} bounds must be between 0 and 100.` }
    }
    if (floor > ceiling) {
      return { error: `${label} floor can't be above its ceiling.` }
    }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profit_thresholds')
    .upsert(
      {
        tenant_id: tenant.id,
        labor_min_pct: ranges.labor_min_pct,
        labor_max_pct: ranges.labor_max_pct,
        materials_min_pct: ranges.materials_min_pct,
        materials_max_pct: ranges.materials_max_pct,
        min_profit_margin_pct: ranges.min_profit_margin_pct,
        profit_max_pct: ranges.profit_max_pct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/margins')
  revalidatePath('/admin/quotes')
  return { success: true }
}
