import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProfitThresholds } from '@/lib/types'
import QuoteEditor from '../QuoteEditor'

export default async function NewQuotePage() {
  const { appUser, tenant } = await getCurrentUser({ roles: ['admin', 'estimator'] })
  const adminClient = createAdminClient()

  const { data: thresholdsRow } = await adminClient
    .from('profit_thresholds')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const thresholds = (thresholdsRow as ProfitThresholds | null) ?? {
    id: '',
    tenant_id: tenant.id,
    labor_max_pct: 30,
    materials_max_pct: 14,
    min_profit_margin_pct: 50,
    created_at: '',
    updated_at: '',
  }

  return (
    <QuoteEditor
      estimate={null}
      thresholds={thresholds}
      tenantName={tenant.name}
      role={appUser.role === 'estimator' ? 'estimator' : 'admin'}
    />
  )
}
