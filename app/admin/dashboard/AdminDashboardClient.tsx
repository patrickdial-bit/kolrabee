'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'
import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Project } from '@/lib/types'
import type { DashboardStage, DashboardStageKey, RecentProject, TopSub } from './page'

interface AdminDashboardClientProps {
  adminFirstName: string
  tenantName: string
  tenantSlug: string
  tenantPlan: string
  trialEndsAt: string | null
  maxProjects: number
  maxSubcontractors: number
  projectCount: number
  subCount: number
  stages: DashboardStage[]
  paidThisMonth: number
  completionRate: number
  recentProjects: RecentProject[]
  topSubs: TopSub[]
  pendingInviteCount: number
  unreadTotal: number
  pendingCompletionCount: number
}

// Stage → label, accent color, and the Projects-page tab it deep-links to.
const STAGE_META: Record<DashboardStageKey, { label: string; tab: string; dot: string; bar: string }> = {
  available: { label: 'Available', tab: 'Available', dot: 'bg-slate-400', bar: 'bg-slate-400' },
  active: { label: 'Accepted / In Progress', tab: 'Accepted', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  completed: { label: 'Completed', tab: 'Completed', dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
  paid: { label: 'Paid', tab: 'Paid', dot: 'bg-primary-600', bar: 'bg-primary-600' },
}

const STATUS_BADGE: Record<Project['status'], { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-slate-100 text-slate-700' },
  accepted: { label: 'Accepted', className: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  pending_completion: { label: 'Pending Completion', className: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Completed', className: 'bg-indigo-100 text-indigo-700' },
  paid: { label: 'Paid', className: 'bg-primary-100 text-primary-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
}

export default function AdminDashboardClient({
  adminFirstName,
  tenantName,
  tenantSlug,
  tenantPlan,
  trialEndsAt,
  maxProjects,
  maxSubcontractors,
  projectCount,
  subCount,
  stages,
  paidThisMonth,
  completionRate,
  recentProjects,
  topSubs,
  pendingInviteCount,
  unreadTotal,
  pendingCompletionCount,
}: AdminDashboardClientProps) {
  const byKey = (k: DashboardStageKey) => stages.find((s) => s.key === k) ?? { key: k, count: 0, value: 0 }
  const available = byKey('available')
  const active = byKey('active')
  const completed = byKey('completed')
  const paid = byKey('paid')

  const pipelineValue = available.value + active.value
  const pipelineCount = available.count + active.count
  const maxStageValue = Math.max(1, ...stages.map((s) => s.value))

  const unlimited = (n: number) => n < 0 || n >= 999999
  const projectsPct = unlimited(maxProjects) ? 0 : Math.min(100, Math.round((projectCount / Math.max(1, maxProjects)) * 100))
  const subsPct = unlimited(maxSubcontractors) ? 0 : Math.min(100, Math.round((subCount / Math.max(1, maxSubcontractors)) * 100))

  const trialDaysLeft =
    tenantPlan === 'trial' && trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null

  const dashboardTourSteps: TourStep[] = [
    {
      target: '#tour-kpis',
      title: 'Your Key Metrics',
      content: 'A quick read on pipeline value, revenue this month, active jobs, and your crew — updated in real time.',
      placement: 'bottom',
    },
    {
      target: '#tour-pipeline',
      title: 'Pipeline at a Glance',
      content: 'See how your jobs are distributed across stages. Click any stage to jump straight to those projects.',
      placement: 'bottom',
    },
    {
      target: '#tour-recent',
      title: 'Recent Activity',
      content: 'Your most recently created projects show up here so you can pick up where you left off.',
      placement: 'top',
    },
  ]

  const attention: { label: string; href: string; tone: string }[] = []
  if (trialDaysLeft !== null) {
    attention.push({
      label: trialDaysLeft === 0 ? 'Trial expired — subscribe to keep going' : `Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`,
      href: '/admin/billing',
      tone: 'amber',
    })
  }
  if (pendingCompletionCount > 0) {
    attention.push({
      label: `${pendingCompletionCount} job${pendingCompletionCount === 1 ? '' : 's'} awaiting your review`,
      href: '/admin/projects?status=Completed',
      tone: 'indigo',
    })
  }
  if (unreadTotal > 0) {
    attention.push({
      label: `${unreadTotal} unread message${unreadTotal === 1 ? '' : 's'}`,
      href: '/admin/projects?status=Accepted',
      tone: 'primary',
    })
  }
  if (pendingInviteCount > 0) {
    attention.push({
      label: `${pendingInviteCount} subcontractor invite${pendingInviteCount === 1 ? '' : 's'} pending`,
      href: '/admin/projects',
      tone: 'slate',
    })
  }

  const toneClasses: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
    primary: 'border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  }

  return (
    <AppShell variant="admin" companyName={tenantName}>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {adminFirstName ? `Welcome back, ${adminFirstName}` : 'Dashboard'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">Here&apos;s what&apos;s happening at {tenantName || 'your company'} today.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/projects"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              View Projects
            </Link>
            <Link
              href="/admin/projects/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Project
            </Link>
          </div>
        </div>

        {/* Attention strip */}
        {attention.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {attention.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${toneClasses[a.tone]}`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {a.label}
              </Link>
            ))}
          </div>
        )}

        {/* KPI cards */}
        <div id="tour-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Pipeline Value"
            value={formatCurrency(pipelineValue)}
            sub={`${pipelineCount} open project${pipelineCount === 1 ? '' : 's'}`}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            }
            accent="text-primary-600"
          />
          <KpiCard
            label="Revenue This Month"
            value={formatCurrency(paidThisMonth)}
            sub={`${paid.count} job${paid.count === 1 ? '' : 's'} paid all-time`}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            }
            accent="text-emerald-600"
          />
          <KpiCard
            label="Active Jobs"
            value={String(active.count)}
            sub={`${completed.count} awaiting payment`}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
            }
            accent="text-amber-600"
          />
          <KpiCard
            label="Subcontractors"
            value={unlimited(maxSubcontractors) ? String(subCount) : `${subCount}/${maxSubcontractors}`}
            sub={`${completionRate}% completion rate`}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            }
            accent="text-forest-500"
          />
        </div>

        {/* Pipeline */}
        <div id="tour-pipeline" className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Pipeline</h2>
            <Link href="/admin/projects" className="text-xs font-semibold text-ember hover:text-primary-700">View all projects →</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stages.map((stage) => {
              const meta = STAGE_META[stage.key]
              const pct = Math.round((stage.value / maxStageValue) * 100)
              return (
                <Link
                  key={stage.key}
                  href={`/admin/projects?status=${meta.tab}`}
                  className="group rounded-lg border border-gray-200 p-4 hover:border-ember hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <span className="text-xs font-medium text-gray-500">{meta.label}</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-gray-900">{formatCurrency(stage.value)}</p>
                  <p className="text-xs text-gray-400">{stage.count} project{stage.count === 1 ? '' : 's'}</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent projects */}
          <div id="tour-recent" className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Projects</h2>
              <Link href="/admin/projects" className="text-xs font-semibold text-ember hover:text-primary-700">View all →</Link>
            </div>
            {recentProjects.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium text-gray-900">No projects yet</p>
                <p className="mt-1 text-sm text-gray-500">Create your first project to get started.</p>
                <Link href="/admin/projects/new" className="mt-4 inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                  Add Project
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentProjects.map((p) => {
                  const badge = STATUS_BADGE[p.status] ?? { label: p.status, className: 'bg-gray-100 text-gray-500' }
                  return (
                    <li key={p.id}>
                      <Link href={`/admin/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {p.customer_name}
                            {p.job_number && <span className="ml-1 font-normal text-gray-400">#{p.job_number}</span>}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {p.accepted_by_name ? `Assigned to ${p.accepted_by_name}` : `Added ${formatDate(p.created_at)}`}
                          </p>
                        </div>
                        <span className={`hidden sm:inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums w-20 text-right">
                          {formatCurrency(p.payout_amount)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            {/* Plan usage */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Plan Usage</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{tenantPlan}</span>
              </div>
              <UsageBar
                label="Projects"
                used={projectCount}
                max={maxProjects}
                pct={projectsPct}
                unlimited={unlimited(maxProjects)}
              />
              <div className="mt-4">
                <UsageBar
                  label="Subcontractors"
                  used={subCount}
                  max={maxSubcontractors}
                  pct={subsPct}
                  unlimited={unlimited(maxSubcontractors)}
                />
              </div>
              {(tenantPlan === 'free' || tenantPlan === 'trial') && (
                <Link href="/admin/billing" className="mt-4 inline-block text-xs font-semibold text-ember hover:text-primary-700">
                  Upgrade plan →
                </Link>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
              <div className="space-y-1">
                <QuickAction href="/admin/projects/new" label="New Project" />
                <QuickAction href="/admin/subcontractors" label="Manage Subcontractors" />
                <QuickAction href="/admin/time-tracking" label="Time Tracking" />
                <QuickAction href="/admin/photos/galleries" label="Photo Galleries" />
              </div>
            </div>

            {/* Top subcontractors */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Top Subcontractors</h2>
                <Link href="/admin/subcontractors" className="text-xs font-semibold text-ember hover:text-primary-700">All →</Link>
              </div>
              {topSubs.length === 0 ? (
                <p className="text-sm text-gray-500">No paid jobs yet.</p>
              ) : (
                <ul className="space-y-3">
                  {topSubs.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                        {i + 1}
                      </span>
                      <Link href={`/admin/subcontractors/${s.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 hover:text-ember">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.jobs} job{s.jobs === 1 ? '' : 's'} paid</p>
                      </Link>
                      <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(s.paid)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      <GuidedTour steps={dashboardTourSteps} tourKey="admin-dashboard" />
    </AppShell>
  )
}

function KpiCard({ label, value, sub, icon, accent }: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <svg className={`h-5 w-5 ${accent}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" aria-hidden="true">
          {icon}
        </svg>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  )
}

function UsageBar({ label, used, max, pct, unlimited }: {
  label: string
  used: number
  max: number
  pct: number
  unlimited: boolean
}) {
  const near = !unlimited && pct >= 80
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{used}/{unlimited ? '∞' : max}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${unlimited ? 'bg-primary-300' : near ? 'bg-amber-500' : 'bg-primary-600'}`}
          style={{ width: unlimited ? '12%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {label}
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  )
}
