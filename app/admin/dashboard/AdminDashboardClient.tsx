'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import StatusTabs from '@/components/StatusTabs'
import InviteSubsModal from '@/app/admin/projects/[id]/InviteSubsModal'
import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import Tooltip from '@/components/Tooltip'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'
import type { PlatformInvite } from './page'

type SortKey = 'customer_name' | 'start_date' | 'payout_amount' | 'estimated_labor_hours' | 'address'
type SortDir = 'asc' | 'desc'

interface AdminDashboardClientProps {
  projects: Project[]
  subNameMap: Record<string, string>
  tenantName: string
  tenantId: string
  tenantSlug: string
  tenantPlan: string
  trialEndsAt: string | null
  maxProjects: number
  maxSubcontractors: number
  projectCount: number
  subCount: number
  platformInvites: PlatformInvite[]
}

const STATUS_TABS = ['Available', 'Accepted', 'Paid']

export default function AdminDashboardClient({
  projects,
  subNameMap,
  tenantName,
  tenantId,
  tenantSlug,
  tenantPlan,
  trialEndsAt,
  maxProjects,
  maxSubcontractors,
  projectCount,
  subCount,
  platformInvites,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('Available')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('start_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const router = useRouter()

  const subLoginUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${tenantSlug}/login`
    : `/${tenantSlug}/login`

  const copySubLoginLink = useCallback(() => {
    navigator.clipboard.writeText(
      `${window.location.origin}/${tenantSlug}/login`
    )
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }, [tenantSlug])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    c['Available'] = projects.filter((p) => p.status === 'available').length
    c['Accepted'] = projects.filter((p) => p.status === 'accepted' || p.status === 'in_progress' || p.status === 'completed').length
    c['Paid'] = projects.filter((p) => p.status === 'paid').length
    return c
  }, [projects])

  const filtered = useMemo(() => {
    let result: Project[]
    if (activeTab === 'Available') {
      result = projects.filter((p) => p.status === 'available')
    } else if (activeTab === 'Accepted') {
      result = projects.filter((p) => p.status === 'accepted' || p.status === 'in_progress' || p.status === 'completed')
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

    return result
  }, [projects, activeTab, search, sortKey, sortDir])

  const dashboardTourSteps: TourStep[] = [
    {
      target: '#tour-add-project',
      title: 'Create a New Project',
      content: 'Click here to add a new project. Fill in the job details, payout, and any links to work orders or photos.',
      placement: 'bottom',
    },
    {
      target: '#tour-search-projects',
      title: 'Search Projects',
      content: 'Quickly find projects by customer name, job number, or address.',
      placement: 'bottom',
    },
    {
      target: '#tour-usage-stats',
      title: 'Plan Usage',
      content: 'Track how many projects and subcontractors you\'re using against your plan limits.',
      placement: 'bottom',
    },
    {
      target: '#tour-status-tabs',
      title: 'Filter by Status',
      content: 'Switch between Available, Accepted, and Paid tabs to see projects at each stage.',
      placement: 'bottom',
    },
    {
      target: '#tour-project-table',
      title: 'Your Projects',
      content: 'Click any column header to sort. Use the Invite button to send projects to subcontractors. Edit, cancel, or mark projects as paid from here.',
      placement: 'top',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <div id="tour-search-projects" className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-48 sm:w-64 rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
              />
            </div>
            <Tooltip text="Create a new project with job details, payout, and links">
              <Link
                id="tour-add-project"
                href="/admin/projects/new"
                className="inline-flex items-center justify-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
              >
                Add Project
              </Link>
            </Tooltip>
          </div>
        </div>

        {/* Trial Banner */}
        {tenantPlan === 'trial' && trialEndsAt && (() => {
          const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          const expired = daysLeft === 0
          return (
            <div className={`mb-6 rounded-lg border p-4 ${expired ? 'bg-amber-50 border-amber-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${expired ? 'text-amber-800' : 'text-amber-800'}`}>
                  {expired
                    ? 'Your free trial has expired. Subscribe to continue creating projects.'
                    : `Free trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
                </p>
                <Link href="/admin/billing" className="text-sm font-semibold text-ember hover:text-primary-700">
                  {expired ? 'Subscribe Now' : 'View Plans'}
                </Link>
              </div>
            </div>
          )
        })()}

        {/* Usage & Money Display */}
        <div id="tour-usage-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">In Progress</p>
            <p className="mt-1 text-lg font-bold text-indigo-600">
              {formatCurrency(projects.filter(p => p.status === 'accepted' || p.status === 'in_progress' || p.status === 'completed').reduce((sum, p) => sum + (p.payout_amount ?? 0), 0))}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</p>
            <p className="mt-1 text-lg font-bold text-green-600">
              {formatCurrency(projects.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.payout_amount ?? 0), 0))}
            </p>
          </div>
        </div>

        {/* Subcontractor Login Link */}
        {tenantSlug && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Subcontractor Login Link</p>
                <p className="text-sm text-gray-600 truncate">{subLoginUrl}</p>
              </div>
              <button
                onClick={copySubLoginLink}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  linkCopied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {linkCopied ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">Send this link to your subcontractors so they can log in to their portal.</p>
          </div>
        )}

        {/* Platform Invites */}
        {platformInvites.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Subcontractor Invites</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Invited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {platformInvites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm text-gray-900">{invite.name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{invite.email}</td>
                      <td className="px-4 py-2.5">
                        {invite.status === 'accepted' ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            Accepted
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">
                        {new Date(invite.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div id="tour-status-tabs">
          <StatusTabs tabs={STATUS_TABS} activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
        </div>

        {/* Table */}
        <div id="tour-project-table" className="mt-6">
          {filtered.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="text-sm font-semibold text-gray-900">No {activeTab.toLowerCase()} projects</h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'Available' ? 'Get started by creating a new project.' : `No ${activeTab.toLowerCase()} projects yet.`}
              </p>
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((project) => (
                <div key={project.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/projects/${project.id}`} className="text-sm font-semibold text-gray-900 hover:text-ember">
                        {project.customer_name}
                      </Link>
                      {project.job_number && <span className="ml-1 text-xs text-gray-400">#{project.job_number}</span>}
                    </div>
                    <span className="text-sm font-bold text-gray-900 ml-2">{formatCurrency(project.payout_amount)}</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 mb-3">
                    <p>{formatDateTime(project.start_date, project.start_time)}</p>
                    <p className="truncate">{project.address}</p>
                    {activeTab === 'Accepted' && project.accepted_by && subNameMap[project.accepted_by] && (
                      <p className="text-ember font-medium">Accepted by: {subNameMap[project.accepted_by]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeTab === 'Available' && (
                      <button
                        onClick={() => setInviteProjectId(project.id)}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Invite
                      </button>
                    )}
                    {activeTab === 'Accepted' && (
                      <>
                        <Link href={`/admin/projects/${project.id}`}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                          Paid
                        </Link>
                        <Link href={`/admin/projects/${project.id}`}
                          className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200">
                          Cancel
                        </Link>
                      </>
                    )}
                    <Link href={`/admin/projects/${project.id}`}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Details
                    </Link>
                    {project.work_order_link && (
                      <a href={project.work_order_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-ember">WO</a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-forest">
                  <tr>
                    {activeTab === 'Available' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Invite</th>
                    )}
                    <SortTh label="Project Number / ID" sortKey="customer_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                    {activeTab === 'Accepted' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Accepted by</th>
                    )}
                    <SortTh label="Project Start" sortKey="start_date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                    <SortTh label="Payout" sortKey="payout_amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                    <SortTh label="Est. Hours" sortKey="estimated_labor_hours" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                    <SortTh label="Address" sortKey="address" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Work Order</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Notes</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Photos</th>
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
                          {project.accepted_by && subNameMap[project.accepted_by]
                            ? (
                              <Link href={`/admin/subcontractors/${project.accepted_by}`} className="text-ember hover:text-primary-700 font-medium">
                                {subNameMap[project.accepted_by]}
                              </Link>
                            )
                            : '—'}
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
                            className="text-ember hover:text-primary-700 font-medium">Link</a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {project.notes ? (
                          <Link href={`/admin/projects/${project.id}`} className="text-ember hover:text-primary-700 font-medium">
                            View Note
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {project.companycam_link ? (
                          <a href={project.companycam_link} target="_blank" rel="noopener noreferrer"
                            className="text-ember hover:text-primary-700 font-medium">Link</a>
                        ) : '—'}
                      </td>
                      {activeTab === 'Accepted' && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            <Link href={`/admin/projects/${project.id}`}
                              className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors">
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
                        <Link href={`/admin/projects/${project.id}`} className="text-amber-600 hover:text-amber-800">
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
            </>
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

      {/* Guided tour for first-time users */}
      <GuidedTour steps={dashboardTourSteps} tourKey="admin-dashboard" />
    </div>
  )
}

function SortTh({ label, sortKey: key, currentKey, dir, onSort, align }: {
  label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align: 'left' | 'right'
}) {
  const active = key === currentKey
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white cursor-pointer select-none hover:bg-forest-700 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
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
