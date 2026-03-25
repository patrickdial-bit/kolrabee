'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import SubNav from '@/components/SubNav'
import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import Tooltip from '@/components/Tooltip'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'
import {
  acceptProject,
  cancelAcceptedProject,
  markInProgress,
  markCompleted,
} from '@/app/[slug]/projects/[id]/actions'

interface SubDashboardClientProps {
  slug: string
  tenantName: string
  ytdEarnings: number
  allTimeEarnings: number
  availableProjects: Project[]
  myJobs: Project[]
  paidProjects: Project[]
  subName: string
}

const columnConfig = [
  { key: 'available', label: 'Available', color: 'bg-amber-500', emptyKey: 'dash.no_available' },
  { key: 'accepted', label: 'Accepted', color: 'bg-blue-500', emptyKey: 'dash.no_accepted' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-indigo-500', emptyKey: 'dash.no_in_progress' },
  { key: 'completed', label: 'Completed', color: 'bg-green-500', emptyKey: 'dash.no_completed' },
  { key: 'paid', label: 'Paid', color: 'bg-emerald-600', emptyKey: 'dash.no_paid' },
] as const

export default function SubDashboardClient({
  slug,
  tenantName,
  ytdEarnings,
  allTimeEarnings,
  availableProjects,
  myJobs,
  paidProjects,
  subName,
}: SubDashboardClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [showAcceptModal, setShowAcceptModal] = useState<Project | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<typeof columnConfig[number]['key']>('available')

  // Organize projects into columns
  const columns = useMemo(() => {
    const accepted = myJobs.filter((p) => p.status === 'accepted')
    const inProgress = myJobs.filter((p) => p.status === 'in_progress')
    const completed = myJobs.filter((p) => p.status === 'completed')
    return {
      available: availableProjects,
      accepted,
      in_progress: inProgress,
      completed,
      paid: paidProjects,
    }
  }, [availableProjects, myJobs, paidProjects])

  // Queue count = accepted + in_progress
  const queueCount = columns.accepted.length + columns.in_progress.length

  const handleAccept = async (project: Project) => {
    setLoading(true)
    setError(null)
    try {
      const result = await acceptProject(project.id, project.version, slug)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success(`Job accepted! ${formatCurrency(project.payout_amount)} added to your queue.`); router.refresh() }
      setShowAcceptModal(null)
    } catch {
      toast.error('Something went wrong. Try again.')
      setShowAcceptModal(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (project: Project) => {
    setLoading(true)
    setError(null)
    try {
      const result = await cancelAcceptedProject(project.id, project.version, slug)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.info('Job cancelled. It\'s back in the Available pool.'); router.refresh() }
      setShowCancelConfirm(null)
    } catch {
      toast.error('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkInProgress = async (project: Project) => {
    setLoading(true)
    setError(null)
    try {
      const result = await markInProgress(project.id, project.version, slug)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success('Job started! Get after it.'); router.refresh() }
    } catch {
      toast.error('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkCompleted = async (project: Project) => {
    setLoading(true)
    setError(null)
    try {
      const result = await markCompleted(project.id, project.version, slug)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success(`Job complete! ${formatCurrency(project.payout_amount)} — payment incoming.`); router.refresh() }
    } catch {
      toast.error('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const tourSteps: TourStep[] = [
    {
      target: '#tour-sub-stats',
      title: t('tour.sub_stats_title') || 'Your Stats',
      content: t('tour.sub_stats_content') || 'Track your earnings and jobs in queue at a glance.',
      placement: 'bottom',
    },
    {
      target: '#tour-sub-kanban',
      title: t('tour.sub_kanban_title') || 'Your Job Board',
      content: t('tour.sub_kanban_content') || 'Jobs flow from left to right: Available, Accepted, In Progress, Completed, Paid. Use the buttons on each card to advance.',
      placement: 'top',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <SubNav slug={slug} tenantName={tenantName} subName={subName} />

      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('dash.title')}</h1>

        {/* Stats row */}
        <div id="tour-sub-stats" className="mb-6 flex flex-wrap items-center gap-3">
          <Tooltip text={t('tip.paid_ytd')} position="bottom">
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="text-sm font-medium text-gray-500">{t('dash.paid_ytd')}</span>
              <span className="text-lg font-bold text-ember">{formatCurrency(ytdEarnings)}</span>
            </div>
          </Tooltip>
          <Tooltip text={t('tip.all_time')} position="bottom">
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="text-sm font-medium text-gray-500">{t('dash.all_time')}</span>
              <span className="text-lg font-bold text-gray-700">{formatCurrency(allTimeEarnings)}</span>
            </div>
          </Tooltip>
          <Tooltip text={t('tip.queue_count') || 'Jobs you have accepted or started.'} position="bottom">
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="text-sm font-medium text-gray-500">{t('dash.jobs_in_queue') || 'Jobs in Queue'}</span>
              <span className="text-lg font-bold text-indigo-600">{queueCount}</span>
            </div>
          </Tooltip>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-amber-50 p-4">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        {/* Mobile: Tab-based view */}
        <div id="tour-sub-kanban" className="md:hidden">
          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {columnConfig.map((col) => {
              const count = columns[col.key].length
              const isActive = mobileTab === col.key
              return (
                <button
                  key={col.key}
                  onClick={() => setMobileTab(col.key)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? `${col.color} text-white`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {col.label}
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active tab content */}
          <div className="space-y-3">
            {columns[mobileTab].length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-400">
                  {t(columnConfig.find(c => c.key === mobileTab)?.emptyKey ?? '') || 'No projects'}
                </p>
              </div>
            ) : (
              columns[mobileTab].map((project) => (
                <KanbanCard
                  key={project.id}
                  project={project}
                  column={mobileTab}
                  slug={slug}
                  loading={loading}
                  showCancelConfirm={showCancelConfirm}
                  onAccept={() => setShowAcceptModal(project)}
                  onStartJob={() => handleMarkInProgress(project)}
                  onMarkComplete={() => handleMarkCompleted(project)}
                  onCancel={() =>
                    showCancelConfirm === project.id
                      ? handleCancel(project)
                      : setShowCancelConfirm(project.id)
                  }
                  onCancelDismiss={() => setShowCancelConfirm(null)}
                  t={t}
                />
              ))
            )}
          </div>
        </div>

        {/* Desktop: Kanban Board */}
        <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
          {columnConfig.map((col) => {
            const projects = columns[col.key]
            return (
              <div key={col.key} className="flex-shrink-0 w-72 min-w-[18rem]">
                {/* Column header */}
                <div className={`${col.color} rounded-t-lg px-4 py-2.5 flex items-center justify-between`}>
                  <h3 className="text-sm font-semibold text-white">{col.label}</h3>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-xs font-bold text-white">
                    {projects.length}
                  </span>
                </div>

                {/* Column body */}
                <div className="bg-gray-100 rounded-b-lg p-3 space-y-3 min-h-[200px]">
                  {projects.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">
                      {t(col.emptyKey) || 'No projects'}
                    </p>
                  ) : (
                    projects.map((project) => (
                      <KanbanCard
                        key={project.id}
                        project={project}
                        column={col.key}
                        slug={slug}
                        loading={loading}
                        showCancelConfirm={showCancelConfirm}
                        onAccept={() => setShowAcceptModal(project)}
                        onStartJob={() => handleMarkInProgress(project)}
                        onMarkComplete={() => handleMarkCompleted(project)}
                        onCancel={() =>
                          showCancelConfirm === project.id
                            ? handleCancel(project)
                            : setShowCancelConfirm(project.id)
                        }
                        onCancelDismiss={() => setShowCancelConfirm(null)}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Accept Project Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAcceptModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-ember/15 flex items-center justify-center">
                <svg className="w-6 h-6 text-ember" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('modal.accept_title')}</h3>
            <p className="text-sm text-gray-600 mb-6">{t('modal.accept_body')}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowAcceptModal(null)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('modal.cancel')}
              </button>
              <button
                onClick={() => handleAccept(showAcceptModal)}
                disabled={loading}
                className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? t('action.accepting') : t('modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <GuidedTour steps={tourSteps} tourKey="sub-dashboard" />
    </div>
  )
}

function KanbanCard({
  project,
  column,
  slug,
  loading,
  showCancelConfirm,
  onAccept,
  onStartJob,
  onMarkComplete,
  onCancel,
  onCancelDismiss,
  t,
}: {
  project: Project
  column: string
  slug: string
  loading: boolean
  showCancelConfirm: string | null
  onAccept: () => void
  onStartJob: () => void
  onMarkComplete: () => void
  onCancel: () => void
  onCancelDismiss: () => void
  t: (key: string) => string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="flex items-start justify-between mb-2">
        <Link
          href={`/${slug}/projects/${project.id}`}
          className="text-sm font-semibold text-gray-900 hover:text-ember transition-colors line-clamp-1"
        >
          {project.customer_name}
        </Link>
        {project.job_number && (
          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">#{project.job_number}</span>
        )}
      </div>

      {/* Card details */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {formatDateTime(project.start_date, project.start_time)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
          </svg>
          <span className="line-clamp-1">{project.address}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">{formatCurrency(project.payout_amount)}</span>
          {project.estimated_labor_hours ? (
            <span className="text-xs font-semibold text-emerald-600">
              {formatCurrency(project.payout_amount / project.estimated_labor_hours)}/hr
            </span>
          ) : null}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex items-center gap-3 mb-3">
        {project.work_order_link && (
          <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-ember hover:text-primary-700">{t('th.work_order') || 'Work Order'}</a>
        )}
        {project.companycam_link && (
          <a href={project.companycam_link} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-ember hover:text-primary-700">{t('th.photos') || 'Photos'}</a>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {column === 'available' && (
          <button
            onClick={onAccept}
            disabled={loading}
            className="flex-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {t('action.accept')}
          </button>
        )}

        {column === 'accepted' && (
          <>
            <button
              onClick={onStartJob}
              disabled={loading}
              className="flex-1 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              Start Job
            </button>
            {showCancelConfirm === project.id ? (
              <div className="flex gap-1">
                <button onClick={onCancel} disabled={loading}
                  className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50">
                  {loading ? '...' : t('action.confirm')}
                </button>
                <button onClick={onCancelDismiss}
                  className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200">
                  {t('action.no')}
                </button>
              </div>
            ) : (
              <button
                onClick={onCancel}
                disabled={loading}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {t('action.cancel')}
              </button>
            )}
          </>
        )}

        {column === 'in_progress' && (
          <button
            onClick={onMarkComplete}
            disabled={loading}
            className="flex-1 rounded-md bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  )
}
