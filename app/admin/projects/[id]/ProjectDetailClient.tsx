'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Project } from '@/lib/types'
import { updateProject, markCompleted, markPaid, cancelProject, deleteProject } from './actions'
import InviteSubsModal from './InviteSubsModal'

interface InvitationWithName {
  id: string
  project_id: string
  tenant_id: string
  subcontractor_id: string
  status: 'invited' | 'accepted' | 'declined'
  invited_at: string
  subcontractor_name: string
  subcontractor_email: string
}

interface ProjectDetailClientProps {
  project: Project
  invitations: InvitationWithName[]
  acceptedByUser: { first_name: string; last_name: string; email: string } | null
  tenantName: string
  tenantId: string
}

const statusColors: Record<string, string> = {
  available: 'bg-blue-100 text-blue-700',
  accepted: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
}

const inviteStatusColors: Record<string, string> = {
  invited: 'bg-gray-100 text-gray-600',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
}

export default function ProjectDetailClient({
  project,
  invitations,
  acceptedByUser,
  tenantName,
  tenantId,
}: ProjectDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const clearMessages = () => {
    setError(null)
    setSuccessMsg(null)
  }

  const handleUpdate = (formData: FormData) => {
    clearMessages()
    startTransition(async () => {
      const result = await updateProject(project.id, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Project updated successfully.')
        setEditing(false)
        router.refresh()
      }
    })
  }

  const handleMarkCompleted = () => {
    clearMessages()
    startTransition(async () => {
      const result = await markCompleted(project.id)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Project marked as completed.')
        router.refresh()
      }
    })
  }

  const handleMarkPaid = () => {
    clearMessages()
    startTransition(async () => {
      const result = await markPaid(project.id)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Project marked as paid.')
        router.refresh()
      }
    })
  }

  const handleCancel = () => {
    clearMessages()
    if (!confirm('Are you sure you want to cancel this project? It will return to Available status.')) {
      return
    }
    startTransition(async () => {
      const result = await cancelProject(project.id, project.version)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Project cancelled and returned to available.')
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    clearMessages()
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return
    }
    startTransition(async () => {
      const result = await deleteProject(project.id)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-700">{successMsg}</p>
          </div>
        )}

        {/* Project Detail Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              {project.job_number && (
                <p className="text-sm font-medium text-indigo-600 mb-1">#{project.job_number}</p>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{project.customer_name}</h1>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${
                statusColors[project.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {project.status}
            </span>
          </div>

          {editing ? (
            /* Edit Form */
            <form action={handleUpdate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="job_number" className="block text-sm font-medium text-gray-700 mb-1">
                    Job Number
                  </label>
                  <input
                    type="text"
                    id="job_number"
                    name="job_number"
                    defaultValue={project.job_number ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="customer_name"
                    name="customer_name"
                    required
                    defaultValue={project.customer_name}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  defaultValue={project.address}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    defaultValue={project.start_date ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="payout_amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Payout Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      id="payout_amount"
                      name="payout_amount"
                      required
                      min="0"
                      step="0.01"
                      defaultValue={project.payout_amount}
                      className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="companycam_link" className="block text-sm font-medium text-gray-700 mb-1">
                  CompanyCam Link
                </label>
                <input
                  type="url"
                  id="companycam_link"
                  name="companycam_link"
                  defaultValue={project.companycam_link ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={project.notes ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="admin_notes" className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea
                  id="admin_notes"
                  name="admin_notes"
                  rows={3}
                  defaultValue={project.admin_notes ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); clearMessages() }}
                  className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* Read-only display */
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project.address}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(project.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payout Amount</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(project.payout_amount)}</dd>
                </div>
                {project.companycam_link && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">CompanyCam</dt>
                    <dd className="mt-1 text-sm">
                      <a
                        href={project.companycam_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline"
                      >
                        View Photos
                      </a>
                    </dd>
                  </div>
                )}
                {project.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{project.notes}</dd>
                  </div>
                )}
                {project.admin_notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Admin Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{project.admin_notes}</dd>
                  </div>
                )}
                {project.paid_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Paid At</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(project.paid_at)}</dd>
                  </div>
                )}
              </dl>

              {/* Accepted by */}
              {project.status !== 'available' && acceptedByUser && (
                <div className="mb-6 rounded-md bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm font-medium text-yellow-800">
                    Accepted by: {acceptedByUser.first_name} {acceptedByUser.last_name}
                  </p>
                  <p className="text-sm text-yellow-700">{acceptedByUser.email}</p>
                  {project.accepted_at && (
                    <p className="text-xs text-yellow-600 mt-1">on {formatDate(project.accepted_at)}</p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {project.status === 'available' && (
                  <>
                    <button
                      onClick={() => { setEditing(true); clearMessages() }}
                      className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center rounded-md bg-white border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                    >
                      Invite Subs
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}

                {project.status === 'accepted' && (
                  <>
                    <button
                      onClick={handleMarkCompleted}
                      disabled={isPending}
                      className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? 'Processing...' : 'Mark Completed'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel Assignment
                    </button>
                  </>
                )}

                {project.status === 'completed' && (
                  <>
                    <button
                      onClick={handleMarkPaid}
                      disabled={isPending}
                      className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? 'Processing...' : 'Mark Paid'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel Assignment
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Invitations section */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Invitations</h2>
            {project.status === 'available' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                + Invite More
              </button>
            )}
          </div>

          {invitations.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.subcontractor_name}</p>
                    <p className="text-xs text-gray-500">{inv.subcontractor_email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      inviteStatusColors[inv.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {inv.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No subcontractors have been invited yet.</p>
          )}
        </div>
      </main>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteSubsModal
          projectId={project.id}
          tenantId={tenantId}
          existingInvitationSubIds={invitations.map((i) => i.subcontractor_id)}
          onClose={() => {
            setShowInviteModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
