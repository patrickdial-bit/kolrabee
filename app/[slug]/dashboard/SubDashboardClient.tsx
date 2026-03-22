'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SubNav from '@/components/SubNav'
import StatusTabs from '@/components/StatusTabs'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'
import { acceptProject, cancelAcceptedProject } from '@/app/[slug]/projects/[id]/actions'

interface SubDashboardClientProps {
  slug: string
  tenantName: string
  ytdEarnings: number
  availableProjects: Project[]
  myJobs: Project[]
  paidProjects: Project[]
  subName: string
}

export default function SubDashboardClient({
  slug,
  tenantName,
  ytdEarnings,
  availableProjects,
  myJobs,
  paidProjects,
  subName,
}: SubDashboardClientProps) {
  const tabs = ['Available Projects', 'Accepted Projects', 'Paid Projects']
  const [activeTab, setActiveTab] = useState('Available Projects')
  const [showAcceptModal, setShowAcceptModal] = useState<Project | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Subcontractor Dashboard</h1>

        {/* Paid YTD — always visible */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-gray-500">Paid YTD</span>
          <span className="text-lg font-bold text-indigo-600">{formatCurrency(ytdEarnings)}</span>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <StatusTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="mt-6">


          {/* Available Projects Tab */}
          {activeTab === 'Available Projects' && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subcontractor Available Projects</h2>
              {availableProjects.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm text-gray-500">No available projects. New projects will appear here when you are invited.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-amber-500">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project ID</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Work Order Link</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project Start Date/Time</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Estimated Hours</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">Payout</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Street City State Zip</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {availableProjects.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{project.customer_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.work_order_link ? (
                              <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 font-medium">Link</a>
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
                            <button
                              onClick={() => setShowAcceptModal(project)}
                              className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                            >
                              Accept Project
                            </button>
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
          {activeTab === 'Accepted Projects' && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subcontractor Accepted Projects</h2>
              {myJobs.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm text-gray-500">No active jobs. Accept an available project to see it here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-amber-500">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project ID</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Work Order Link</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project Start Date/Time</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Estimated Hours</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">Payout</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Street City State Zip</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {myJobs.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{project.customer_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.work_order_link ? (
                              <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 font-medium">Link</a>
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
                                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                                    {loading ? '...' : 'Confirm'}
                                  </button>
                                  <button onClick={() => setShowCancelConfirm(null)}
                                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200">
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setShowCancelConfirm(project.id)}
                                  className="inline-flex items-center rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors">
                                  Cancel
                                </button>
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
          {activeTab === 'Paid Projects' && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">All Paid Projects</h2>
              {paidProjects.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm text-gray-500">No paid projects yet. Completed and paid projects will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project Start</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">Payout</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Estimated Hours</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Address</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Work Order</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Photos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paidProjects.map((project) => (
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
                              <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 font-medium">Link</a>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {project.companycam_link ? (
                              <a href={project.companycam_link} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 font-medium">Link</a>
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
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Accept Project</h3>
            <p className="text-sm text-gray-600 mb-6">
              I accept the WO as written and agree to produce the full scope of the project for the payment listed, and will return after walk through for touch ups on the work that I performed, as necessary. I also agree that my required insurance is up to date.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowAcceptModal(null)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAccept(showAcceptModal)}
                disabled={loading}
                className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Accepting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
