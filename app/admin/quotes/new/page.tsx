import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProfitThresholds } from '@/lib/types'
import { DEFAULT_PROFIT_THRESHOLDS } from '@/lib/types'
import QuoteEditor from '../QuoteEditor'

export default async function NewQuotePage() {
  const { appUser, tenant } = await getCurrentUser({ roles: ['admin', 'estimator'] })
  const adminClient = createAdminClient()

  const { data: thresholdsRow } = await adminClient
    .from('profit_thresholds')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const thresholds = (thresholdsRow as ProfitThresholds | null) ?? { ...DEFAULT_PROFIT_THRESHOLDS, tenant_id: tenant.id }

  return (
    <QuoteEditor
      estimate={null}
      thresholds={thresholds}
      tenantName={tenant.name}
      role={appUser.role === 'estimator' ? 'estimator' : 'admin'}
    />
  )
}
