'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/AdminNav'
import { formatCurrency, formatInsuranceDate } from '@/lib/utils'
import { isSubCompliant } from '@/lib/types'
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
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.company_name && s.company_name.toLowerCase().includes(q))
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

      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Subcontractors</h1>
            <p className="mt-1 text-sm text-gray-500">
              {subcontractors.filter(s => s.status === 'active').length} active subcontractor{subcontractors.filter(s => s.status === 'active').length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <h3 className="text-sm font-semibold text-gray-900">
              {search ? 'No subcontractors found' : 'No subcontractors yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search ? 'Try adjusting your search terms.' : 'Subcontractors will appear here once they sign up.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-red-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">First Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Last Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Crew</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Insurance Exp.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Insurance Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Phone</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Years</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">COI</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">W-9</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Edit</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((sub) => {
                  const insuranceInfo = formatInsuranceDate(sub.insurance_expiration)
                  return (
                    <tr key={sub.id} className={`hover:bg-gray-50 transition-colors ${sub.status === 'deleted' ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sub.company_name || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.first_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.last_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">{sub.crew_size ?? '—'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-medium ${insuranceInfo.isExpired ? 'text-red-600 bg-red-50' : 'text-gray-600'}`}>
                        {insuranceInfo.text}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.insurance_provider || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">{sub.address || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.phone ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">{sub.years_in_business ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {sub.coi_file_url ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
                            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {sub.w9_file_url ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
                            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Link href={`/admin/subcontractors/${sub.id}`} className="text-amber-600 hover:text-amber-800">
                          <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                          </svg>
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {sub.status === 'active' ? (
                          confirmDeleteId === sub.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleDelete(sub.id)} disabled={isPending}
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                                {isPending ? '...' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} disabled={isPending}
                                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                                No
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(sub.id)}
                              className="text-red-600 hover:text-red-800">
                              <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          )
                        ) : (
                          <button onClick={() => handleReactivate(sub.id)} disabled={isPending}
                            className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                            {isPending ? '...' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
