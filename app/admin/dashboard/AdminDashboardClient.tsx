'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/AdminNav'
import StatusTabs from '@/components/StatusTabs'
import { formatCurrency, formatDate, type Project } from '@/lib/helpers'

interface AdminDashboardClientProps {
  projects: Project[]
  tenantName: string
}

const STATUS_TABS = ['Available', 'Accepted', 'Completed', 'Paid']

const statusColors: Record<string, string> = {
  available: 'bg-blue-100 text-blue-700',
  accepted: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function AdminDashboardClient({
  projects,
  tenantName,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('Available')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const tab of STATUS_TABS) {
      c[tab] = projects.filter(
        (p) => p.status === tab.toLowerCase()
      ).length
    }
    return c
  }, [projects])

  const filtered = useMemo(() => {
    const statusKey = activeTab.toLowerCase()
    let result = projects.filter((p) => p.status === statusKey)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          (p.job_number && p.job_number.toLowerCase().includes(q)) ||
          p.customer_name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
      )
    }

    // Sort by start_date soonest first (nulls last)
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your projects and subcontractor assignments.
            </p>
          </div>
          <Link
            href="/admin/projects/new"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </Link>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by job number, customer, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <StatusTabs
          tabs={STATUS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={counts}
        />

        {/* Project grid */}
        {filtered.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    {project.job_number && (
                      <p className="text-xs font-medium text-indigo-600 mb-1">
                        #{project.job_number}
                      </p>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {project.customer_name}
                    </h3>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      statusColors[project.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <p className="text-sm text-gray-500 truncate mb-3">
                  {project.address}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {formatDate(project.start_date)}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(project.payout_amount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5Z"
              />
            </svg>
            <h3 className="mt-3 text-sm font-semibold text-gray-900">
              No {activeTab.toLowerCase()} projects
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'Available'
                ? 'Get started by creating a new project.'
                : `You don't have any ${activeTab.toLowerCase()} projects yet.`}
            </p>
            {activeTab === 'Available' && (
              <Link
                href="/admin/projects/new"
                className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                New Project
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
