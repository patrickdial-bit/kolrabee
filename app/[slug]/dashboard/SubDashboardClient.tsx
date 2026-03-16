'use client'

import { useState } from 'react'
import Link from 'next/link'
import SubNav from '@/components/SubNav'
import StatusTabs from '@/components/StatusTabs'
import { extractCity, formatCurrency, formatDate } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface SubDashboardClientProps {
  slug: string
  tenantName: string
  ytdEarnings: number
  availableProjects: Project[]
  myJobs: Project[]
  paidProjects: Project[]
  subName: string
}

const statusBadgeClasses: Record<string, string> = {
  accepted: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
  available: 'bg-yellow-100 text-yellow-700',
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
  const tabs = ['Available', 'My Jobs', 'Paid']
  const [activeTab, setActiveTab] = useState('Available')

  const counts: Record<string, number> = {
    Available: availableProjects.length,
    'My Jobs': myJobs.length,
    Paid: paidProjects.length,
  }

  const currentProjects =
    activeTab === 'Available'
      ? availableProjects
      : activeTab === 'My Jobs'
        ? myJobs
        : paidProjects

  return (
    <div className="min-h-screen bg-gray-50">
      <SubNav slug={slug} tenantName={tenantName} subName={subName} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* YTD Earnings Card */}
        <div className="mb-8 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white shadow-lg">
          <p className="text-sm font-medium text-indigo-200">Year-to-Date Earnings</p>
          <p className="mt-2 text-4xl font-bold">{formatCurrency(ytdEarnings)}</p>
        </div>

        {/* Tabs */}
        <StatusTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={counts}
        />

        {/* Project Cards */}
        <div className="mt-6">
          {currentProjects.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">
                {activeTab === 'Available'
                  ? 'No available projects'
                  : activeTab === 'My Jobs'
                    ? 'No active jobs'
                    : 'No paid projects yet'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'Available'
                  ? 'New projects will appear here when you are invited.'
                  : activeTab === 'My Jobs'
                    ? 'Accept an available project to see it here.'
                    : 'Completed and paid projects will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {currentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/${slug}/projects/${project.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      {project.job_number && (
                        <p className="text-xs font-medium text-indigo-600">#{project.job_number}</p>
                      )}
                      <h3 className="mt-1 text-sm font-semibold text-gray-900 truncate">
                        {project.customer_name}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {activeTab === 'Available'
                          ? extractCity(project.address)
                          : project.address}
                      </p>
                    </div>
                    {activeTab !== 'Available' && (
                      <span
                        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses[project.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {activeTab === 'Paid' && project.paid_at
                        ? `Paid ${formatDate(project.paid_at)}`
                        : project.start_date
                          ? formatDate(project.start_date)
                          : 'No date set'}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(project.payout_amount)}
                    </span>
                  </div>

                  {activeTab === 'Available' && project.notes && (
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">{project.notes}</p>
                  )}

                  {activeTab !== 'Available' && project.companycam_link && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                        CompanyCam
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
