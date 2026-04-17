'use client'

import { useMemo, useState, useTransition } from 'react'
import SuperAdminNav from '@/components/SuperAdminNav'
import { startSubImpersonation } from '@/app/super-admin/impersonate/actions'

type SubRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name: string | null
  status: string
  tenant_id: string
  tenantName: string
  tenantSlug: string
  w9_file_url: string | null
  coi_file_url: string | null
  insurance_expiration: string | null
  created_at: string
}

interface Props {
  subs: SubRow[]
}

export default function SubcontractorsClient({ subs }: Props) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    if (!search.trim()) return subs
    const q = search.toLowerCase()
    return subs.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.company_name ?? '').toLowerCase().includes(q) ||
        s.tenantName.toLowerCase().includes(q) ||
        s.tenantSlug.toLowerCase().includes(q)
    )
  }, [subs, search])

  const activeCount = subs.filter((s) => s.status === 'active').length

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminNav />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Subcontractors</h1>
          <p className="text-sm text-gray-500">{activeCount} active / {subs.length} total</p>
        </div>

        <div className="mb-4">
          <div className="relative max-w-md">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, company, tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Tenant</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-200">W-9</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-200">COI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No subcontractors found.</td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${s.status === 'deleted' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-sm text-gray-900">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.company_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="font-medium text-gray-900">{s.tenantName}</div>
                      <div className="text-xs text-gray-500">/{s.tenantSlug}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {s.w9_file_url ? <span className="text-green-600">Yes</span> : <span className="text-amber-500">No</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {s.coi_file_url ? <span className="text-green-600">Yes</span> : <span className="text-amber-500">No</span>}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-600">{s.status}</td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'active' && (
                        <button
                          onClick={() => startTransition(() => startSubImpersonation(s.id))}
                          disabled={isPending}
                          className="inline-flex items-center rounded-md bg-ember px-3 py-1.5 text-xs font-semibold text-white hover:bg-ember/90 transition-colors disabled:opacity-50"
                        >
                          Log in as
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
