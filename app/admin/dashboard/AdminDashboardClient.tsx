'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import StatusTabs from '@/components/StatusTabs'
import InviteSubsModal from '@/app/admin/projects/[id]/InviteSubsModal'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface AdminDashboardClientProps {
  projects: Project[]
  tenantName: string
  tenantId: string
  tenantPlan: string
  trialEndsAt: string | null
  maxProjects: number
  maxSubcontractors: number
  projectCount: number
  subCount: number
}

const STATUS_TABS = ['Available', 'Accepted', 'Paid']

export default function AdminDashboardClient({
  projects,
  tenantName,
  tenantId,
  tenantPlan,
  trialEndsAt,
  maxProjects,
  maxSubcontractors,
  projectCount,
  subCount,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('Available')
  const [search, setSearch] = useState('')
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null)
  const router = useRouter()

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    c['Available'] = projects.filter((p) => p.status === 'available').length
    c['Accepted'] = projects.filter((p) => p.status === 'accepted' || p.status === 'completed').length
    c['Paid'] = projects.filter((p) => p.status === 'paid').length
    return c
  }, [projects])

  const filtered = useMemo(() => {
    let result: Project[]
    if (activeTab === 'Available') {
      result = projects.filter((p) => p.status === 'available')
    } else if (activeTab === 'Accepted') {
      result = projects.filter((p) => p.status === 'accepted' || p.status === 'completed')
    } else {
      result = projects.filter((p) => p.status === 'paid')
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          (p.job_number && p.job_number.toLowerCase().includes(q)) ||
          p.customer_name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0
      if (!a.start_date) return 1
      if (!b.start_date) return -1
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })

    return result
  }, [projects, activeTab, search])

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-48 sm:w-64 rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <Link
              href="/admin/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Add Project
            </Link>
          </div>
        </div>

        {/* Trial Banner */}
        {tenantPlan === 'trial' && trialEndsAt && (() => {
          const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          const expired = daysLeft === 0
          return (
            <div className={`mb-6 rounded-lg border p-4 ${expired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${expired ? 'text-red-800' : 'text-amber-800'}`}>
                  {expired
                    ? 'Your free trial has expired. Subscribe to continue creating projects.'
                    : `Free trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
                </p>
                <Link href="/admin/billing" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                  {expired ? 'Subscribe Now' : 'View Plans'}
                </Link>
              </div>
            </div>
          )
        })()}

        {/* Usage Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Projects Used</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {projectCount}/{maxProjects >= 999999 ? '∞' : maxProjects}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subcontractors</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {subCount}/{maxSubcontractors >= 999999 ? '∞' : maxSubcontractors}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <StatusTabs tabs={STATUS_TABS} activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

        {/* Table */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="text-sm font-semibold text-gray-900">No {activeTab.toLowerCase()} projects</h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'Available' ? 'Get started by creating a new project.' : `No ${activeTab.toLowerCase()} projects yet.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-700">
                  <tr>
                    {activeTab === 'Available' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Invite</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project Number / ID</th>
                    {activeTab === 'Accepted' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Accepted by</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Project Start</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">Payout</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">Est. Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Address</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Work Order</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Notes</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">CompanyCam</th>
                    {activeTab === 'Accepted' && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Action</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Paid</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Edit</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      {activeTab === 'Available' && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setInviteProjectId(project.id)}
                            className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                          >
                            Invite
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {project.customer_name}
                        {project.job_number && <span className="ml-1 text-gray-500">#{project.job_number}</span>}
                      </td>
                      {activeTab === 'Accepted' && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {/* acceptedByUser name will be filled via server */}
                          —
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDateTime(project.start_date, project.start_time)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(project.payout_amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                        {project.estimated_labor_hours ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                        {project.address}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {project.work_order_link ? (
                          <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 font-medium">Link</a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {project.notes ? (
                          <Link href={`/admin/projects/${project.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                            View Note
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {project.companycam_link ? (
                          <a href={project.companycam_link} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 font-medium">Link</a>
                        ) : '—'}
                      </td>
                      {activeTab === 'Accepted' && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            <Link href={`/admin/projects/${project.id}`}
                              className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors">
                              Cancel
                            </Link>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            <Link href={`/admin/projects/${project.id}`}
                              className="inline-flex items-center rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                              Paid
                            </Link>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Link href={`/admin/projects/${project.id}`} className="text-amber-600 hover:text-amber-800">
                          <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                          </svg>
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Link href={`/admin/projects/${project.id}`} className="text-red-600 hover:text-red-800">
                          <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Invite modal */}
      {inviteProjectId && (
        <InviteSubsModal
          projectId={inviteProjectId}
          tenantId={tenantId}
          existingInvitationSubIds={[]}
          onClose={() => {
            setInviteProjectId(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
