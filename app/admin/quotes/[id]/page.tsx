import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProfitThresholds, ProjectEstimate } from '@/lib/types'
import QuoteEditor from '../QuoteEditor'

interface PageProps {
  params: { id: string }
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const { appUser, tenant } = await getCurrentUser({ roles: ['admin', 'estimator'] })
  const adminClient = createAdminClient()

  let query = adminClient
    .from('project_estimates')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)

  // Estimators can only open their own quotes.
  if (appUser.role === 'estimator') {
    query = query.eq('created_by', appUser.id)
  }

  const { data: estimate } = await query.maybeSingle()

  if (!estimate) {
    notFound()
  }

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
      estimate={estimate as ProjectEstimate}
      thresholds={thresholds}
      tenantName={tenant.name}
      role={appUser.role === 'estimator' ? 'estimator' : 'admin'}
    />
  )
}
