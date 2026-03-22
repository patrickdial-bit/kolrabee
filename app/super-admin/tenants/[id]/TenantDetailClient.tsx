'use client'

import Link from 'next/link'
import SuperAdminNav from '@/components/SuperAdminNav'
import { updateTenantPlan, suspendTenant, deleteTenant } from './actions'
import { useState, useTransition } from 'react'

interface Props {
  tenant: any
  users: any[]
  projects: any[]
  invites: any[]
}

const planOptions = ['free', 'trial', 'starter', 'pro', 'cancelled'] as const

export default function TenantDetailClient({ tenant, users, projects, invites }: Props) {
  const [isPending, startTransition] = useTransition()
  const [planMessage, setPlanMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const admins = users.filter((u) => u.role === 'admin')
  const subs = users.filter((u) => u.role === 'subcontractor')
  const activeProjects = projects.filter((p) => p.status !== 'cancelled')

  const statusCounts: Record<string, number> = {}
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1
  }

  function handlePlanChange(newPlan: string) {
    setPlanMessage('')
    startTransition(async () => {
      const result = await updateTenantPlan(tenant.id, newPlan)
      if (result.error) {
        setPlanMessage(result.error)
      } else {
        setPlanMessage(`Plan updated to ${newPlan}`)
        setTimeout(() => setPlanMessage(''), 3000)
      }
    })
  }

  function handleSuspend() {
    setActionMessage('')
    startTransition(async () => {
      const result = await suspendTenant(tenant.id)
      if (result.error) {
        setActionMessage(result.error)
      } else {
        setActionMessage(result.status === 'suspended' ? 'Tenant suspended.' : 'Tenant reactivated.')
        setTimeout(() => setActionMessage(''), 3000)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTenant(tenant.id)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminNav />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link + title */}
        <div className="mb-6">
          <Link href="/super-admin" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            &larr; All Tenants
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            {tenant.status === 'suspended' && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Suspended
              </span>
            )}
            {tenant.status === 'deleted' && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                Deleted
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">/{tenant.slug}</p>

          {/* Suspend / Delete actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSuspend}
              disabled={isPending}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                tenant.status === 'suspended'
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-amber-500 text-white hover:bg-amber-400'
              }`}
            >
              {tenant.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2">
                <span className="text-sm text-red-700">Delete this company and all its data?</span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {actionMessage && (
            <p className={`mt-2 text-sm font-medium ${actionMessage.includes('error') ? 'text-red-600' : 'text-green-600'}`}>
              {actionMessage}
            </p>
          )}
        </div>

        {/* Tenant Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tenant Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Plan</dt>
                <dd>
                  <select
                    defaultValue={tenant.plan}
                    disabled={isPending}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                  >
                    {planOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </dd>
              </div>
              {planMessage && (
                <p className={`text-xs ${planMessage.includes('error') ? 'text-red-600' : 'text-green-600'}`}>
                  {planMessage}
                </p>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{new Date(tenant.created_at).toLocaleDateString()}</dd>
              </div>
              {tenant.trial_ends_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Trial Ends</dt>
                  <dd className="text-gray-900">{new Date(tenant.trial_ends_at).toLocaleDateString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Max Projects</dt>
                <dd className="text-gray-900">{tenant.max_projects >= 999999 ? 'Unlimited' : tenant.max_projects}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Max Subs</dt>
                <dd className="text-gray-900">{tenant.max_subcontractors >= 999999 ? 'Unlimited' : tenant.max_subcontractors}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Notification Email</dt>
                <dd className="text-gray-900">{tenant.notification_email || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Admins</p>
                <p className="text-lg font-bold text-gray-900">{admins.length}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Subcontractors</p>
                <p className="text-lg font-bold text-gray-900">{subs.filter((s) => s.status === 'active').length}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Total Projects</p>
                <p className="text-lg font-bold text-gray-900">{activeProjects.length}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Pending Invites</p>
                <p className="text-lg font-bold text-gray-900">{invites.filter((i) => i.status === 'pending').length}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Admin Users */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Admin Users</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {admins.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 text-sm text-gray-900">{u.first_name} {u.last_name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-2.5 text-sm capitalize text-gray-600">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subcontractors */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Subcontractors ({subs.length})</h2>
          {subs.length === 0 ? (
            <p className="text-sm text-gray-500">No subcontractors yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Company</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-gray-500">W-9</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-gray-500">COI</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subs.map((u) => (
                    <tr key={u.id} className={u.status === 'deleted' ? 'opacity-50' : ''}>
                      <td className="px-4 py-2.5 text-sm text-gray-900">{u.first_name} {u.last_name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{u.company_name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-2.5 text-center text-sm">
                        {u.w9_file_url ? <span className="text-green-600">Yes</span> : <span className="text-red-500">No</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm">
                        {u.coi_file_url ? <span className="text-green-600">Yes</span> : <span className="text-red-500">No</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm capitalize text-gray-600">{u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Projects ({projects.length})</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">No projects yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Customer</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Address</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-gray-500">Payout</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 text-sm text-gray-900">
                        {p.customer_name}
                        {p.job_number && <span className="ml-1 text-gray-400">#{p.job_number}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[200px] truncate">{p.address}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-900 text-right font-medium">
                        ${p.payout_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
