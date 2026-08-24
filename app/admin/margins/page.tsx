import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Project, ProfitThresholds, ProjectEstimate, ProjectLedgerEntry } from '@/lib/types'
import { getMarginStatus } from '@/lib/types'
import MarginsClient, { type MarginRow } from './MarginsClient'

const DEFAULT_THRESHOLDS: Pick<ProfitThresholds, 'labor_max_pct' | 'materials_max_pct' | 'min_profit_margin_pct'> = {
  labor_max_pct: 30,
  materials_max_pct: 14,
  min_profit_margin_pct: 50,
}

export default async function MarginsPage() {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  // 'imported' projects are CompanyCam documentation only — no payout data,
  // so they're excluded from every job-costing view, same as the Projects list.
  const { data: projects } = await adminClient
    .from('projects')
    .select('id, job_number, customer_name, status, start_date, payout_amount')
    .eq('tenant_id', tenant.id)
    .neq('status', 'imported')
    .order('start_date', { ascending: false, nullsFirst: false })

  const projectIds = (projects ?? []).map((p) => p.id)

  const [{ data: estimates }, { data: ledgerEntries }, { data: thresholdsRow }] = await Promise.all([
    projectIds.length > 0
      ? adminClient.from('project_estimates').select('*').in('project_id', projectIds)
      : Promise.resolve({ data: [] as ProjectEstimate[] }),
    projectIds.length > 0
      ? adminClient.from('project_ledger_entries').select('*').in('project_id', projectIds)
      : Promise.resolve({ data: [] as ProjectLedgerEntry[] }),
    adminClient.from('profit_thresholds').select('*').eq('tenant_id', tenant.id).maybeSingle(),
  ])

  const thresholds = (thresholdsRow as ProfitThresholds | null) ?? DEFAULT_THRESHOLDS

  const estimateByProject = new Map((estimates ?? []).map((e: any) => [e.project_id, e as ProjectEstimate]))
  const ledgerByProject = new Map((ledgerEntries ?? []).map((l: any) => [l.project_id, l as ProjectLedgerEntry]))

  const rows: MarginRow[] = (projects ?? []).map((p) => {
    const estimate = estimateByProject.get(p.id) ?? null
    const ledger = ledgerByProject.get(p.id) ?? null

    // Prefer actuals once the job's been cost out; fall back to the estimate.
    // Actual labor % comes from actual_crew_pay, not the (now stale) estimate
    // — otherwise a job that ran over on labor wouldn't show it here.
    const source = ledger
      ? {
          laborPct: ledger.total_price > 0 ? (Number(ledger.actual_crew_pay) / Number(ledger.total_price)) * 100 : 0,
          materialPct: ledger.total_price > 0 ? (Number(ledger.actual_material_cost) / Number(ledger.total_price)) * 100 : 0,
          profitPct: Number(ledger.actual_margin_pct),
          isActual: true,
        }
      : estimate
        ? {
            laborPct: Number(estimate.labor_pct),
            materialPct: Number(estimate.material_pct),
            profitPct: Number(estimate.projected_profit_pct),
            isActual: false,
          }
        : null

    const status = source ? getMarginStatus(source.materialPct, source.laborPct, source.profitPct, thresholds) : null

    return {
      projectId: p.id,
      jobNumber: p.job_number,
      customerName: p.customer_name,
      status: p.status as Project['status'],
      startDate: p.start_date,
      hasEstimate: !!estimate,
      hasLedger: !!ledger,
      laborPct: source?.laborPct ?? null,
      materialPct: source?.materialPct ?? null,
      profitPct: source?.profitPct ?? null,
      isActual: source?.isActual ?? false,
      marginStatus: status,
    }
  })

  return <MarginsClient rows={rows} thresholds={thresholds} tenantName={tenant.name} />
}
