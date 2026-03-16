'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/AdminNav'
import { formatCurrency } from '@/lib/utils'
import { softDeleteSub, reactivateSub } from './actions'
import type { SubcontractorWithStats } from '@/lib/types'

interface Props {
  subcontractors: SubcontractorWithStats[]
  tenantName: string
}

export default function SubcontractorListClient({ subcontractors, tenantName }: Props) {
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    if (!search.trim()) return subcontractors
    const q = search.toLowerCase()
    return subcontractors.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
      return (
        fullName.includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q))
      )
    })
  }, [subcontractors, search])

  function handleDelete(userId: string) {
    startTransition(async () => {
      await softDeleteSub(userId)
      setConfirmDeleteId(null)
    })
  }

  function handleReactivate(userId: string) {
    startTransition(async () => {
      await reactivateSub(userId)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subcontractors</h1>
            <p className="mt-1 text-sm text-gray-500">
              {subcontractors.length} total subcontractor{subcontractors.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          /* Empty state */
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 10.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-9-3.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="mt-4 text-sm font-semibold text-gray-900">
              {search ? 'No subcontractors found' : 'No subcontractors yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? 'Try adjusting your search terms.'
                : 'Subcontractors will appear here once they sign up.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">YTD Paid</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Active Jobs</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/admin/subcontractors/${sub.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                          {sub.first_name} {sub.last_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sub.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sub.phone ?? '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            sub.status === 'active'
                              ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                              : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                          }`}
                        >
                          {sub.status === 'active' ? 'Active' : 'Deleted'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(sub.ytdPaid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {sub.activeJobs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {sub.status === 'active' ? (
                          confirmDeleteId === sub.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleDelete(sub.id)}
                                disabled={isPending}
                                className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {isPending ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isPending}
                                className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(sub.id)}
                              className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleReactivate(sub.id)}
                            disabled={isPending}
                            className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                          >
                            {isPending ? 'Reactivating...' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((sub) => (
                <div key={sub.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <Link href={`/admin/subcontractors/${sub.id}`} className="block">
                      <p className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                        {sub.first_name} {sub.last_name}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">{sub.email}</p>
                      {sub.phone && <p className="text-sm text-gray-500">{sub.phone}</p>}
                    </Link>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        sub.status === 'active'
                          ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                          : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                      }`}
                    >
                      {sub.status === 'active' ? 'Active' : 'Deleted'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">YTD Paid:</span>{' '}
                      <span className="font-medium text-gray-900">{formatCurrency(sub.ytdPaid)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Active Jobs:</span>{' '}
                      <span className="font-medium text-gray-900">{sub.activeJobs}</span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    {sub.status === 'active' ? (
                      confirmDeleteId === sub.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(sub.id)}
                            disabled={isPending}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {isPending ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isPending}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(sub.id)}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleReactivate(sub.id)}
                        disabled={isPending}
                        className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {isPending ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
