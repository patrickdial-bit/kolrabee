'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AppUser, Project } from '@/lib/types'
import { isSubCompliant } from '@/lib/types'
import type { ReliabilityStats } from './page'
import { softDeleteSub, reactivateSub } from '../actions'
import { getDocumentUrl } from './doc-actions'

const statusColors: Record<string, string> = {
  available: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  accepted: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  completed: 'bg-ember/10 text-ember ring-ember/20',
  paid: 'bg-green-50 text-green-700 ring-green-600/20',
  cancelled: 'bg-gray-50 text-gray-700 ring-gray-600/20',
}

interface Props {
  sub: AppUser
  projects: Project[]
  ytdEarnings: number
  reliabilityStats: ReliabilityStats
  tenantName: string
  tenantSlug: string
}

export default function SubDetailClient({ sub, projects, ytdEarnings, reliabilityStats, tenantName, tenantSlug }: Props) {
  const [isPending, startTransition] = useTransition()
  const [docLoading, setDocLoading] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const router = useRouter()

  async function handleViewDoc(docType: 'w9' | 'coi') {
    setDocError(null)
    setDocLoading(docType)
    const result = await getDocumentUrl(sub.id, docType)
    setDocLoading(null)
    if (result.error) {
      setDocError(result.error)
    } else if (result.url) {
      window.open(result.url, '_blank')
    }
  }

  function handleStatusToggle() {
    if (sub.status === 'active' && !confirm(`Remove ${sub.first_name} ${sub.last_name}? They won't receive new invitations.`)) return
    startTransition(async () => {
      if (sub.status === 'active') {
        const result = await softDeleteSub(sub.id)
        if (result?.error) toast.error(result.error)
        else toast.success(`${sub.first_name} ${sub.last_name} removed.`)
      } else {
        const result = await reactivateSub(sub.id)
        if (result?.error) toast.error(result.error)
        else toast.success(`${sub.first_name} ${sub.last_name} reactivated.`)
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ember hover:text-primary-700 mb-6"
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
                      : 'bg-amber-50 text-amber-700 ring-amber-600/20'
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
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-ember/10 text-ember hover:bg-ember/15'
                }`}
              >
                {isPending
                  ? sub.status === 'active' ? 'Deleting...' : 'Reactivating...'
                  : sub.status === 'active' ? 'Delete Subcontractor' : 'Reactivate Subcontractor'}
              </button>
            </div>
          </div>
        </div>

        {/* Reliability & Performance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">YTD Earnings</p>
            <p className="mt-1 text-2xl font-bold text-ember">{formatCurrency(ytdEarnings)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accept Rate</p>
            <p className={`mt-1 text-2xl font-bold ${reliabilityStats.acceptRate >= 70 ? 'text-green-600' : reliabilityStats.acceptRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
              {reliabilityStats.totalInvited > 0 ? `${reliabilityStats.acceptRate}%` : '—'}
            </p>
            <p className="text-xs text-gray-400">{reliabilityStats.totalAccepted} of {reliabilityStats.totalInvited} invites</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</p>
            <p className={`mt-1 text-2xl font-bold ${reliabilityStats.completionRate >= 80 ? 'text-green-600' : reliabilityStats.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {reliabilityStats.totalAccepted > 0 ? `${reliabilityStats.completionRate}%` : '—'}
            </p>
            <p className="text-xs text-gray-400">{reliabilityStats.totalCompleted} completed, {reliabilityStats.totalPaid} paid</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Declined / Cancelled</p>
            <p className={`mt-1 text-2xl font-bold ${(reliabilityStats.totalDeclined + reliabilityStats.totalCancelled) === 0 ? 'text-green-600' : 'text-amber-600'}`}>
              {reliabilityStats.totalDeclined + reliabilityStats.totalCancelled}
            </p>
            <p className="text-xs text-gray-400">{reliabilityStats.totalDeclined} declined, {reliabilityStats.totalCancelled} cancelled</p>
          </div>
        </div>

        {/* Compliance & Documents */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Compliance &amp; Documents</h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                isSubCompliant(sub)
                  ? 'bg-green-50 text-green-700 ring-green-600/20'
                  : 'bg-amber-50 text-amber-700 ring-amber-600/20'
              }`}
            >
              {isSubCompliant(sub) ? 'Compliant' : 'Not Compliant'}
            </span>
          </div>

          {docError && (
            <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">{docError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* W-9 */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">W-9</p>
                {sub.w9_file_url ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                    Missing
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {sub.w9_uploaded_at ? `Uploaded ${formatDate(sub.w9_uploaded_at)}` : 'Not yet uploaded'}
              </p>
              {sub.w9_file_url && (
                <button
                  onClick={() => handleViewDoc('w9')}
                  disabled={docLoading === 'w9'}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ember/10 px-3 py-1.5 text-xs font-semibold text-ember hover:bg-ember/15 transition-colors disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  {docLoading === 'w9' ? 'Loading...' : 'View / Download'}
                </button>
              )}
            </div>

            {/* COI */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">Certificate of Insurance</p>
                {sub.coi_file_url ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                    Missing
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {sub.coi_uploaded_at ? `Uploaded ${formatDate(sub.coi_uploaded_at)}` : 'Not yet uploaded'}
              </p>
              {sub.coi_file_url && (
                <button
                  onClick={() => handleViewDoc('coi')}
                  disabled={docLoading === 'coi'}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ember/10 px-3 py-1.5 text-xs font-semibold text-ember hover:bg-ember/15 transition-colors disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  {docLoading === 'coi' ? 'Loading...' : 'View / Download'}
                </button>
              )}
            </div>

            {/* Insurance */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">Insurance</p>
                {sub.insurance_expiration && new Date(sub.insurance_expiration) >= new Date() ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    Valid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                    {sub.insurance_expiration ? 'Expired' : 'Missing'}
                  </span>
                )}
              </div>
              <dl className="text-xs text-gray-500 space-y-1">
                <div>
                  <dt className="inline">Provider: </dt>
                  <dd className="inline font-medium text-gray-700">{sub.insurance_provider ?? '—'}</dd>
                </div>
                <div>
                  <dt className="inline">Expires: </dt>
                  <dd className="inline font-medium text-gray-700">{sub.insurance_expiration ? formatDate(sub.insurance_expiration) : '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link href={`/admin/projects/${project.id}`} className="text-ember hover:text-primary-700 hover:underline">
                            {project.job_number ?? project.id.slice(0, 8)}
                          </Link>
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
                        <Link href={`/admin/projects/${project.id}`} className="text-sm font-semibold text-ember hover:text-primary-700 hover:underline">
                          {project.job_number ?? project.id.slice(0, 8)}
                        </Link>
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
