'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AppUser, Project } from '@/lib/types'
import { softDeleteSub, reactivateSub } from '../actions'

const statusColors: Record<string, string> = {
  available: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  accepted: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  completed: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  paid: 'bg-green-50 text-green-700 ring-green-600/20',
  cancelled: 'bg-gray-50 text-gray-700 ring-gray-600/20',
}

interface Props {
  sub: AppUser
  projects: Project[]
  ytdEarnings: number
  tenantName: string
}

export default function SubDetailClient({ sub, projects, ytdEarnings, tenantName }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleStatusToggle() {
    startTransition(async () => {
      if (sub.status === 'active') {
        await softDeleteSub(sub.id)
      } else {
        await reactivateSub(sub.id)
      }
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/admin/subcontractors"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Subcontractors
        </Link>

        {/* Sub info card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <div className="sm:flex sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {sub.first_name} {sub.last_name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    sub.status === 'active'
                      ? 'bg-green-50 text-green-700 ring-green-600/20'
                      : 'bg-red-50 text-red-700 ring-red-600/20'
                  }`}
                >
                  {sub.status === 'active' ? 'Active' : 'Deleted'}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{sub.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{sub.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Joined</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{formatDate(sub.created_at)}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={handleStatusToggle}
                disabled={isPending}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  sub.status === 'active'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {isPending
                  ? sub.status === 'active' ? 'Deleting...' : 'Reactivating...'
                  : sub.status === 'active' ? 'Delete Subcontractor' : 'Reactivate Subcontractor'}
              </button>
            </div>
          </div>
        </div>

        {/* YTD Earnings */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <p className="text-sm font-medium text-gray-500">YTD Earnings</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{formatCurrency(ytdEarnings)}</p>
        </div>

        {/* Project history */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Project History ({projects.length})
          </h2>

          {projects.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No projects yet for this subcontractor.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Job Number</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Payout</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {projects.map((project) => (
                      <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {project.job_number ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {project.customer_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(project.payout_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusColors[project.status] ?? ''}`}>
                            {project.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(project.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {project.job_number ?? 'No Job #'}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-600">{project.customer_name}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusColors[project.status] ?? ''}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">{formatCurrency(project.payout_amount)}</span>
                      <span className="text-gray-500">{formatDate(project.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
