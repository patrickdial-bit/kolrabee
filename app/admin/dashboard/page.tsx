import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUnreadCounts } from '@/lib/message-reads'
import AdminDashboardClient from './AdminDashboardClient'
import type { Project } from '@/lib/types'
import { subDisplayName } from '@/lib/types'

export type DashboardStageKey = 'available' | 'active' | 'completed' | 'paid'

export type DashboardStage = {
  key: DashboardStageKey
  count: number
  value: number
}

export type RecentProject = {
  id: string
  customer_name: string
  job_number: string | null
  status: Project['status']
  payout_amount: number
  start_date: string | null
  start_time: string | null
  created_at: string
  accepted_by_name: string | null
}

export type TopSub = {
  id: string
  name: string
  paid: number
  jobs: number
}

const ACTIVE_STATUSES: Project['status'][] = ['accepted', 'in_progress']
const COMPLETED_STATUSES: Project['status'][] = ['pending_completion', 'completed']

export default async function AdminDashboardPage() {
  const { appUser, tenant } = await getCurrentUser()

  const adminClient = createAdminClient()
  const { data: projectsRaw } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .neq('status', 'cancelled')
  const projects = (projectsRaw ?? []) as Project[]

  // Resolve display names for assigned subcontractors (accepted_by).
  const acceptedByIds = projects
    .map((p) => p.accepted_by)
    .filter((id): id is string => !!id)
  const uniqueIds = Array.from(new Set(acceptedByIds))
  let subNameMap: Record<string, string> = {}
  if (uniqueIds.length > 0) {
    const { data: subs } = await adminClient
      .from('users')
      .select('id, first_name, last_name, company_name')
      .in('id', uniqueIds)
    for (const sub of subs ?? []) {
      subNameMap[sub.id] = subDisplayName(sub)
    }
  }

  // --- Pipeline aggregates by stage ----------------------------------------
  const stageOf = (p: Project): DashboardStageKey | null => {
    if (p.status === 'available') return 'available'
    if (ACTIVE_STATUSES.includes(p.status)) return 'active'
    if (COMPLETED_STATUSES.includes(p.status)) return 'completed'
    if (p.status === 'paid') return 'paid'
    return null
  }
  const stageAcc: Record<DashboardStageKey, DashboardStage> = {
    available: { key: 'available', count: 0, value: 0 },
    active: { key: 'active', count: 0, value: 0 },
    completed: { key: 'completed', count: 0, value: 0 },
    paid: { key: 'paid', count: 0, value: 0 },
  }
  for (const p of projects) {
    const s = stageOf(p)
    if (!s) continue
    stageAcc[s].count += 1
    stageAcc[s].value += p.payout_amount ?? 0
  }
  const stages: DashboardStage[] = [stageAcc.available, stageAcc.active, stageAcc.completed, stageAcc.paid]

  // Revenue paid this month (uses paid_at when available, else created_at).
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let paidThisMonth = 0
  for (const p of projects) {
    if (p.status !== 'paid') continue
    const when = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at)
    if (when >= monthStart) paidThisMonth += p.payout_amount ?? 0
  }

  // Lifetime completion rate: paid / (paid + everything that left "available").
  const startedCount =
    stageAcc.active.count + stageAcc.completed.count + stageAcc.paid.count
  const completionRate = startedCount > 0 ? Math.round((stageAcc.paid.count / startedCount) * 100) : 0

  // --- Recent projects (newest first) --------------------------------------
  const recentProjects: RecentProject[] = [...projects]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      customer_name: p.customer_name,
      job_number: p.job_number,
      status: p.status,
      payout_amount: p.payout_amount ?? 0,
      start_date: p.start_date,
      start_time: p.start_time,
      created_at: p.created_at,
      accepted_by_name: p.accepted_by ? subNameMap[p.accepted_by] ?? null : null,
    }))

  // --- Top subcontractors by paid revenue ----------------------------------
  const subAgg: Record<string, { paid: number; jobs: number }> = {}
  for (const p of projects) {
    if (p.status !== 'paid' || !p.accepted_by) continue
    const entry = subAgg[p.accepted_by] ?? (subAgg[p.accepted_by] = { paid: 0, jobs: 0 })
    entry.paid += p.payout_amount ?? 0
    entry.jobs += 1
  }
  const topSubs: TopSub[] = Object.entries(subAgg)
    .map(([id, v]) => ({ id, name: subNameMap[id] ?? 'Unknown', paid: v.paid, jobs: v.jobs }))
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 5)

  // --- Usage counts --------------------------------------------------------
  const { count: subCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  // Pending subcontractor invites (attention item).
  const { count: pendingInviteCount } = await adminClient
    .from('platform_invites')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'pending')

  // Total unread messages across active projects (attention item).
  const activeProjectIds = projects
    .filter((p) => ['accepted', 'in_progress', 'pending_completion', 'completed'].includes(p.status))
    .map((p) => p.id)
  const unreadCounts = await getUnreadCounts(appUser.id, activeProjectIds)
  const unreadTotal = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0)

  return (
    <AdminDashboardClient
      adminFirstName={appUser.first_name ?? ''}
      tenantName={tenant.name ?? ''}
      tenantSlug={tenant.slug ?? ''}
      tenantPlan={tenant.plan ?? 'free'}
      trialEndsAt={tenant.trial_ends_at ?? null}
      maxProjects={tenant.max_projects ?? 5}
      maxSubcontractors={tenant.max_subcontractors ?? 3}
      projectCount={stageAcc.available.count + startedCount}
      subCount={subCount ?? 0}
      stages={stages}
      paidThisMonth={paidThisMonth}
      completionRate={completionRate}
      recentProjects={recentProjects}
      topSubs={topSubs}
      pendingInviteCount={pendingInviteCount ?? 0}
      unreadTotal={unreadTotal}
      pendingCompletionCount={projects.filter((p) => p.status === 'pending_completion').length}
    />
  )
}
