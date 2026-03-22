'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import SuperAdminNav from '@/components/SuperAdminNav'
import { startImpersonation } from '@/app/super-admin/impersonate/actions'

type TenantWithStats = {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
  trial_ends_at: string | null
  subCount: number
  projectCount: number
  adminEmail: string
  adminName: string
}

interface Props {
  tenants: TenantWithStats[]
  stats: {
    totalTenants: number
    totalSubs: number
    totalProjects: number
    activePlans: number
  }
}

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  trial: 'bg-blue-100 text-blue-700',
  starter: 'bg-green-100 text-green-700',
  pro: 'bg-ember/15 text-ember',
  cancelled: 'bg-red-100 text-red-700',
}

export default function SuperAdminDashboard({ tenants, stats }: Props) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants
    const q = search.toLowerCase()
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.adminEmail.toLowerCase().includes(q) ||
        t.adminName.toLowerCase().includes(q)
    )
  }, [tenants, search])

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminNav />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Overview</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tenants</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalTenants}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subcontractors</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalSubs}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paying</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.activePlans}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
            />
          </div>
        </div>

        {/* Tenant Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Admin</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-200">Plan</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-200">Subs</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-200">Projects</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">Created</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                    <div className="text-xs text-gray-500">/{tenant.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{tenant.adminName}</div>
                    <div className="text-xs text-gray-500">{tenant.adminEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${planColors[tenant.plan] || 'bg-gray-100 text-gray-700'}`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{tenant.subCount}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{tenant.projectCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(tenant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startTransition(() => startImpersonation(tenant.id))}
                        disabled={isPending}
                        className="inline-flex items-center rounded-md bg-ember px-3 py-1.5 text-xs font-semibold text-white hover:bg-ember transition-colors disabled:opacity-50"
                      >
                        Log in as
                      </button>
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
