'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'
import { updateProject, markCompleted, markPaid, cancelProject, deleteProject, approveCompletion } from './actions'
import { submitRating } from './rating-actions'
import { addAttachment, removeAttachment, getAttachmentUrl } from './attachment-actions'
import { sendMessage, getMessages } from './message-actions'
import InviteSubsModal from './InviteSubsModal'
import StarRating from '@/components/StarRating'
import type { SubRating, ProjectAttachment } from '@/lib/types'

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

interface MessageWithSender {
  id: string
  tenant_id: string
  project_id: string
  sender_id: string
  body: string
  created_at: string
  sender_name: string
}

interface ProjectDetailClientProps {
  project: Project
  invitations: InvitationWithName[]
  acceptedByUser: { first_name: string; last_name: string; email: string } | null
  tenantName: string
  tenantId: string
  tenantPlan: string
  existingRating: SubRating | null
  attachments: ProjectAttachment[]
  messages: MessageWithSender[]
  currentUserId: string
}

const statusColors: Record<string, string> = {
  available: 'bg-blue-100 text-blue-700',
  accepted: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  pending_completion: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-amber-100 text-amber-700',
}

const inviteStatusColors: Record<string, string> = {
  invited: 'bg-gray-100 text-gray-600',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-amber-100 text-amber-700',
}

export default function ProjectDetailClient({
  project,
  invitations,
  acceptedByUser,
  tenantName,
  tenantId,
  tenantPlan,
  existingRating,
  attachments,
  messages,
  currentUserId,
}: ProjectDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  // Attachment state
  const [attachUploading, setAttachUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  // Message state
  const [messageText, setMessageText] = useState('')
  const [messagePending, setMessagePending] = useState(false)

  const clearMessages = () => { setError(null); setSuccessMsg(null) }

  const handleUpdate = (formData: FormData) => {
    clearMessages()
    startTransition(async () => {
      const result = await updateProject(project.id, formData)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success('Project updated.'); setEditing(false); router.refresh() }
    })
  }

  const handleMarkCompleted = () => {
    clearMessages()
    startTransition(async () => {
      const result = await markCompleted(project.id)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success('Marked as completed.'); router.refresh() }
    })
  }

  const handleApproveCompletion = () => {
    clearMessages()
    startTransition(async () => {
      const result = await approveCompletion(project.id)
      if (result?.error) setError(result.error)
      else { setSuccessMsg('Completion approved.'); router.refresh() }
    })
  }

  const handleMarkPaid = () => {
    clearMessages()
    startTransition(async () => {
      const result = await markPaid(project.id)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success('Marked as paid. Sub has been notified.'); router.refresh() }
    })
  }

  const handleCancel = () => {
    clearMessages()
    if (!confirm('Cancel this project? It will return to Available status.')) return
    startTransition(async () => {
      const result = await cancelProject(project.id, project.version)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.info('Project cancelled and returned to Available.'); router.refresh() }
    })
  }

  const handleSubmitRating = () => {
    if (ratingValue < 1) return
    clearMessages()
    startTransition(async () => {
      const result = await submitRating(project.id, ratingValue, ratingNote || null)
      if (result?.error) setError(result.error)
      else { setSuccessMsg('Rating submitted.'); setShowRatingModal(false); router.refresh() }
    })
  }

  const handleDownloadAttachment = async (attachmentId: string) => {
    const result = await getAttachmentUrl(attachmentId)
    if (result?.error) setAttachError(result.error)
    else if (result?.url) window.open(result.url, '_blank')
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!confirm('Remove this attachment?')) return
    startTransition(async () => {
      const result = await removeAttachment(attachmentId)
      if (result?.error) setError(result.error)
      else router.refresh()
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (attachments.length + files.length > 3) {
      setAttachError('Maximum 3 attachments per project.')
      return
    }
    setAttachError(null)
    setAttachUploading(true)
    for (const file of Array.from(files)) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png']
      if (!allowed.includes(file.type)) {
        setAttachError('Only PDF, JPG, and PNG files are allowed.')
        setAttachUploading(false)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setAttachError('File size must be under 10MB.')
        setAttachUploading(false)
        return
      }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const path = `${project.tenant_id}/projects/${project.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
      if (uploadError) {
        setAttachError('Failed to upload file.')
        setAttachUploading(false)
        return
      }
      const result = await addAttachment(project.id, file.name, path, file.size, file.type)
      if (result?.error) {
        setAttachError(result.error)
        setAttachUploading(false)
        return
      }
    }
    setAttachUploading(false)
    router.refresh()
    e.target.value = ''
  }

  const handleSendMessage = () => {
    if (!messageText.trim()) return
    setMessagePending(true)
    startTransition(async () => {
      const result = await sendMessage(project.id, messageText.trim())
      if (result?.error) setError(result.error)
      else { setMessageText(''); router.refresh() }
      setMessagePending(false)
    })
  }

  const handleDelete = () => {
    clearMessages()
    if (!confirm('Delete this project? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteProject(project.id)
      if (result?.error) { setError(result.error); toast.error(result.error) }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin/dashboard" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700">
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {error && <div className="mb-4 rounded-md bg-amber-50 p-4"><p className="text-sm text-amber-700">{error}</p></div>}
        {successMsg && <div className="mb-4 rounded-md bg-green-50 p-4"><p className="text-sm text-green-700">{successMsg}</p></div>}

        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              {project.job_number && <p className="text-sm font-medium text-ember mb-1">#{project.job_number}</p>}
              <h1 className="text-2xl font-bold text-gray-900">{project.customer_name}</h1>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${statusColors[project.status] || 'bg-gray-100 text-gray-700'}`}>
              {project.status}
            </span>
          </div>

          {editing ? (
            <form action={handleUpdate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Number</label>
                  <input type="text" name="job_number" defaultValue={project.job_number ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input type="text" name="customer_name" required defaultValue={project.customer_name}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input type="text" name="address" required defaultValue={project.address}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" name="start_date" defaultValue={project.start_date ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" name="start_time" defaultValue={project.start_time ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payout Amount *</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" name="payout_amount" required min="0" step="0.01" defaultValue={project.payout_amount}
                      className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Labor Hours</label>
                  <input type="number" name="estimated_labor_hours" min="0" defaultValue={project.estimated_labor_hours ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Order Link</label>
                <input type="text" name="work_order_link" defaultValue={project.work_order_link ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo Repository Link</label>
                <input type="text" name="companycam_link" defaultValue={project.companycam_link ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea name="notes" rows={3} defaultValue={project.notes ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea name="admin_notes" rows={3} defaultValue={project.admin_notes ?? ''}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={isPending}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setEditing(false); clearMessages() }}
                  className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project.address}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Start Date/Time</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDateTime(project.start_date, project.start_time)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payout Amount</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(project.payout_amount)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Estimated Labor Hours</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project.estimated_labor_hours ?? '—'}</dd>
                </div>
                {project.work_order_link && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Work Order</dt>
                    <dd className="mt-1 text-sm">
                      <a href={project.work_order_link} target="_blank" rel="noopener noreferrer" className="text-ember hover:text-primary-700 underline">View</a>
                    </dd>
                  </div>
                )}
                {project.companycam_link && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Photos</dt>
                    <dd className="mt-1 text-sm">
                      <a href={project.companycam_link} target="_blank" rel="noopener noreferrer" className="text-ember hover:text-primary-700 underline">View Photos</a>
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
                    <dd className="mt-1 text-sm text-gray-900">{new Date(project.paid_at).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>

              {project.status !== 'available' && acceptedByUser && (
                <div className="mb-6 rounded-md bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm font-medium text-yellow-800">Accepted by: {acceptedByUser.first_name} {acceptedByUser.last_name}</p>
                  <p className="text-sm text-yellow-700">{acceptedByUser.email}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {project.status === 'available' && (
                  <>
                    <button onClick={() => { setEditing(true); clearMessages() }}
                      className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Edit</button>
                    <button onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center rounded-md bg-white border border-ember/30 px-4 py-2 text-sm font-semibold text-ember hover:bg-ember/10">Invite Subs</button>
                    <button onClick={handleDelete} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Delete</button>
                  </>
                )}
                {(project.status === 'accepted' || project.status === 'in_progress') && (
                  <>
                    <button onClick={handleMarkCompleted} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      {isPending ? 'Processing...' : 'Mark Completed'}
                    </button>
                    <button onClick={handleMarkPaid} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                      {isPending ? 'Processing...' : 'Mark Paid'}
                    </button>
                    <button onClick={handleCancel} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Cancel</button>
                  </>
                )}
                {project.status === 'pending_completion' && (
                  <>
                    <button onClick={handleApproveCompletion} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      {isPending ? 'Processing...' : 'Approve Completion'}
                    </button>
                    <button onClick={handleMarkPaid} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                      {isPending ? 'Processing...' : 'Mark Paid'}
                    </button>
                    <button onClick={handleCancel} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Cancel</button>
                  </>
                )}
                {project.status === 'completed' && (
                  <>
                    <button onClick={handleMarkPaid} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                      {isPending ? 'Processing...' : 'Mark Paid'}
                    </button>
                    <button onClick={handleCancel} disabled={isPending}
                      className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Cancel</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Invitations */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Invitations</h2>
            {project.status === 'available' && (
              <button onClick={() => setShowInviteModal(true)} className="text-sm font-medium text-ember hover:text-primary-700">+ Invite More</button>
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
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${inviteStatusColors[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                      {inv.status}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No subcontractors have been invited yet.</p>
          )}
        </div>

        {/* Rating */}
        {['completed', 'paid'].includes(project.status) && project.accepted_by && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sub Rating</h2>
            {existingRating ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StarRating value={existingRating.rating} readonly size="md" />
                  <span className="text-sm font-medium text-gray-700">{existingRating.rating}/5</span>
                </div>
                {existingRating.note && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingRating.note}</p>
                )}
              </div>
            ) : tenantPlan === 'free' ? (
              <div>
                <button
                  disabled
                  className="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                >
                  Rate Subcontractor
                </button>
                <p className="mt-2 text-xs text-gray-500">Sub ratings require the <a href="/admin/billing" className="text-ember font-medium hover:underline">Growth plan</a>.</p>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowRatingModal(true)}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Rate Subcontractor
                </button>
              </div>
            )}
          </div>
        )}

        {/* Job Documents (Attachments) */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Job Documents</h2>
            {attachments.length < 3 && (
              <label className="inline-flex items-center gap-1.5 text-sm font-medium text-ember hover:text-primary-700 cursor-pointer">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {attachUploading ? 'Uploading...' : 'Add File'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={attachUploading}
                />
              </label>
            )}
          </div>
          {attachError && (
            <div className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700">{attachError}</div>
          )}
          {attachments.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">{att.file_name}</span>
                    {att.file_size && (
                      <span className="text-xs text-gray-400">{(att.file_size / 1024).toFixed(0)} KB</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadAttachment(att.id)}
                      className="text-xs font-medium text-ember hover:text-primary-700"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      disabled={isPending}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No documents attached. Add up to 3 files (PDF, JPG, PNG).</p>
          )}
        </div>

        {/* Messages */}
        {project.accepted_by && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>
            {tenantPlan === 'free' ? (
              <div>
                <p className="text-sm text-gray-400">In-app messaging requires the <a href="/admin/billing" className="text-ember font-medium hover:underline">Growth plan</a>.</p>
              </div>
            ) : (
              <>
                {messages.length > 0 ? (
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === currentUserId
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg px-4 py-2 ${isMe ? 'bg-ember/10 text-gray-900' : 'bg-gray-100 text-gray-900'}`}>
                            <p className="text-xs font-medium text-gray-500 mb-1">
                              {msg.sender_name} &middot; {new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">No messages yet. Start the conversation.</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={messagePending || !messageText.trim()}
                    className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {messagePending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Subcontractor</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <StarRating value={ratingValue} onChange={setRatingValue} size="lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <textarea
                  value={ratingNote}
                  onChange={(e) => setRatingNote(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                  placeholder="How did this sub perform?"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSubmitRating}
                  disabled={isPending || ratingValue < 1}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {isPending ? 'Submitting...' : 'Submit Rating'}
                </button>
                <button
                  onClick={() => { setShowRatingModal(false); setRatingValue(0); setRatingNote('') }}
                  className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <InviteSubsModal
          projectId={project.id}
          tenantId={tenantId}
          tenantPlan={tenantPlan}
          existingInvitationSubIds={invitations.map((i) => i.subcontractor_id)}
          onClose={() => { setShowInviteModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}
