'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SubNav from '@/components/SubNav'
import StatusTabs from '@/components/StatusTabs'
import Tooltip from '@/components/Tooltip'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'
import { acceptProject, cancelAcceptedProject } from '@/app/[slug]/projects/[id]/actions'

type SubSortKey = 'customer_name' | 'start_date' | 'payout_amount' | 'estimated_labor_hours' | 'address'
type SortDir = 'asc' | 'desc'

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
  const tabs = [t('dash.available'), t('dash.accepted'), t('dash.paid')]
  const [activeIdx, setActiveIdx] = useState(0)
  const activeTab = tabs[activeIdx]
  const [showAcceptModal, setShowAcceptModal] = useState<Project | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SubSortKey>('start_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const router = useRouter()

  const toggleSort = useCallback((key: SubSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sortProjects = useCallback((projects: Project[]) => {
    return [...projects].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'customer_name':
          return dir * a.customer_name.localeCompare(b.customer_name)
        case 'start_date': {
          if (!a.start_date && !b.start_date) return 0
          if (!a.start_date) return 1
          if (!b.start_date) return -1
          return dir * (new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        }
        case 'payout_amount':
          return dir * ((a.payout_amount ?? 0) - (b.payout_amount ?? 0))
        case 'estimated_labor_hours':
          return dir * ((a.estimated_labor_hours ?? 0) - (b.estimated_labor_hours ?? 0))
        case 'address':
          return dir * a.address.localeCompare(b.address)
        default:
          return 0
      }
    })
  }, [sortKey, sortDir])

  const sortedAvailable = useMemo(() => sortProjects(availableProjects), [availableProjects, sortProjects])
  const sortedMyJobs = useMemo(() => sortProjects(myJobs), [myJobs, sortProjects])
  const sortedPaid = useMemo(() => sortProjects(paidProjects), [paidProjects, sortProjects])

  const handleAccept = async (project: Project) => {
    setLoading(true)
    setError(null)
    try {
      const result = await acceptProject(project.id, project.version, slug)
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
      setShowAcceptModal(null)
    } catch {
      setError('An unexpected error occurred.')
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
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
      setShowCancelConfirm(null)
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SubNav slug={slug} tenantName={tenantName} subName={subName} />

      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('dash.title')}</h1>

        {/* Earnings — always visible */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
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
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-amber-50 p-4">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <StatusTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveIdx(tabs.indexOf(tab))}
        />

        <div className="mt-6">


          {/* Available Projects Tab */}
          {activeTab === t('dash.available') && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dash.sub_available')}</h2>
              {availableProjects.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm text-gray-500">{t('dash.no_available')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-amber-500">
                      <tr>
                        <SubSortTh label={t('th.project_id')} sortKey="customer_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="amber" />
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.work_order')}</th>
                        <SubSortTh label={t('th.project_start')} sortKey="start_date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="amber" />
                        <SubSortTh label={t('th.est_hours')} sortKey="estimated_labor_hours" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" bg="amber" />
                        <SubSortTh label={t('th.payout')} sortKey="payout_amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" bg="amber" />
                        <SubSortTh label={t('th.address')} sortKey="address" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="amber" />
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedAvailable.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{project.customer_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.work_order_link ? (
                              <Tooltip text={t('tip.work_order')} position="top">
                                <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                                  className="text-ember hover:text-primary-700 font-medium">{t('action.link')}</a>
                              </Tooltip>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDateTime(project.start_date, project.start_time)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                            {project.estimated_labor_hours ?? '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(project.payout_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{project.address}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <Tooltip text={t('tip.accept_project')} position="left">
                              <button
                                onClick={() => setShowAcceptModal(project)}
                                className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                              >
                                {t('action.accept')}
                              </button>
                            </Tooltip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Accepted Projects Tab */}
          {activeIdx === 1 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dash.sub_accepted')}</h2>
              {myJobs.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm text-gray-500">{t('dash.no_accepted')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-amber-500">
                      <tr>
                        <SubSortTh label={t('th.project_id')} sortKey="customer_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="amber" />
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.work_order')}</th>
                        <SubSortTh label={t('th.project_start')} sortKey="start_date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="amber" />
                        <SubSortTh label={t('th.est_hours')} sortKey="estimated_labor_hours" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" bg="amber" />
                        <SubSortTh label={t('th.payout')} sortKey="payout_amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" bg="amber" />
                        <SubSortTh label={t('th.address')} sortKey="address" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="amber" />
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.status')}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedMyJobs.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{project.customer_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.work_order_link ? (
                              <Tooltip text={t('tip.work_order')} position="top">
                                <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                                  className="text-ember hover:text-primary-700 font-medium">{t('action.link')}</a>
                              </Tooltip>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDateTime(project.start_date, project.start_time)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                            {project.estimated_labor_hours ?? '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(project.payout_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{project.address}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {project.status === 'accepted' && (
                              showCancelConfirm === project.id ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => handleCancel(project)} disabled={loading}
                                    className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-forest disabled:opacity-50">
                                    {loading ? '...' : t('action.confirm')}
                                  </button>
                                  <button onClick={() => setShowCancelConfirm(null)}
                                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200">
                                    {t('action.no')}
                                  </button>
                                </div>
                              ) : (
                                <Tooltip text={t('tip.cancel_project')} position="left">
                                  <button onClick={() => setShowCancelConfirm(project.id)}
                                    className="inline-flex items-center rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors">
                                    {t('action.cancel')}
                                  </button>
                                </Tooltip>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Paid Projects Tab */}
          {activeIdx === 2 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dash.all_paid')}</h2>
              {paidProjects.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm text-gray-500">{t('dash.no_paid')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-700">
                      <tr>
                        <SubSortTh label={t('th.project_id')} sortKey="customer_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="gray" />
                        <SubSortTh label={t('th.project_start')} sortKey="start_date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="gray" />
                        <SubSortTh label={t('th.payout')} sortKey="payout_amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" bg="gray" />
                        <SubSortTh label={t('th.est_hours')} sortKey="estimated_labor_hours" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" bg="gray" />
                        <SubSortTh label={t('th.address')} sortKey="address" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" bg="gray" />
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.work_order')}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">{t('th.photos')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedPaid.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{project.customer_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDateTime(project.start_date, project.start_time)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(project.payout_amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                            {project.estimated_labor_hours ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{project.address}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.work_order_link ? (
                              <Tooltip text={t('tip.work_order')} position="top">
                                <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                                  className="text-ember hover:text-primary-700 font-medium">{t('action.link')}</a>
                              </Tooltip>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.companycam_link ? (
                              <Tooltip text={t('tip.photos_link')} position="top">
                                <a href={project.companycam_link} target="_blank" rel="noopener noreferrer"
                                  className="text-ember hover:text-primary-700 font-medium">{t('action.link')}</a>
                              </Tooltip>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
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
            <p className="text-sm text-gray-600 mb-6">
              {t('modal.accept_body')}
            </p>
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
    </div>
  )
}

function SubSortTh({ label, sortKey: key, currentKey, dir, onSort, align, bg }: {
  label: string; sortKey: SubSortKey; currentKey: SubSortKey; dir: SortDir
  onSort: (k: SubSortKey) => void; align: 'left' | 'right' | 'center'; bg: 'amber' | 'gray'
}) {
  const active = key === currentKey
  const hoverBg = bg === 'amber' ? 'hover:bg-amber-600' : 'hover:bg-gray-800'
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white cursor-pointer select-none ${hoverBg} transition-colors ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          {active && dir === 'desc'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />}
        </svg>
      </span>
    </th>
  )
}
