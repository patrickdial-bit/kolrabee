import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProfitThresholds, ProjectEstimate } from '@/lib/types'
import { getMarginStatus, DEFAULT_PROFIT_THRESHOLDS } from '@/lib/types'
import QuotesClient, { type QuoteRow } from './QuotesClient'

export default async function QuotesPage() {
  const { appUser, tenant } = await getCurrentUser({ roles: ['admin', 'estimator'] })
  const adminClient = createAdminClient()

  let query = adminClient
    .from('project_estimates')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  // Estimators see only their own quotes.
  if (appUser.role === 'estimator') {
    query = query.eq('created_by', appUser.id)
  }

  const [{ data: estimates }, { data: thresholdsRow }] = await Promise.all([
    query,
    adminClient.from('profit_thresholds').select('*').eq('tenant_id', tenant.id).maybeSingle(),
  ])

  const thresholds = (thresholdsRow as ProfitThresholds | null) ?? DEFAULT_PROFIT_THRESHOLDS
  const rows = (estimates ?? []) as ProjectEstimate[]

  // Resolve display names: creators (admin view shows who quoted) and, for
  // linked quotes, the project's customer name as a fallback label.
  const creatorIds = Array.from(new Set(rows.map((r) => r.created_by)))
  const projectIds = rows.map((r) => r.project_id).filter((id): id is string => !!id)

  const [{ data: creators }, { data: projects }] = await Promise.all([
    creatorIds.length > 0
      ? adminClient.from('users').select('id, first_name, last_name').in('id', creatorIds)
      : Promise.resolve({ data: [] as any[] }),
    projectIds.length > 0
      ? adminClient.from('projects').select('id, customer_name, job_number').in('id', projectIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const creatorName = new Map((creators ?? []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`]))
  const projectById = new Map((projects ?? []).map((p: any) => [p.id, p]))

  const quoteRows: QuoteRow[] = rows.map((e) => {
    const project = e.project_id ? projectById.get(e.project_id) : null
    return {
      id: e.id,
      customerName: e.customer_name ?? project?.customer_name ?? 'Unknown',
      customerAddress: e.customer_address,
      paintscoutQuoteId: e.paintscout_quote_id,
      totalPrice: Number(e.total_price),
      laborPct: Number(e.labor_pct),
      materialPct: Number(e.material_pct),
      profitPct: Number(e.projected_profit_pct),
      marginStatus: getMarginStatus(Number(e.material_pct), Number(e.labor_pct), Number(e.projected_profit_pct), thresholds),
      createdAt: e.created_at,
      createdByName: creatorName.get(e.created_by) ?? 'Unknown',
      linkedProject: project ? { id: project.id, label: project.job_number ? `#${project.job_number}` : project.customer_name } : null,
    }
  })

  return (
    <QuotesClient
      rows={quoteRows}
      thresholds={thresholds}
      tenantName={tenant.name}
      role={appUser.role === 'estimator' ? 'estimator' : 'admin'}
    />
  )
}
