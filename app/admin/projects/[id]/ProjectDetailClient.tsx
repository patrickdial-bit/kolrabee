'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Tooltip from '@/components/Tooltip'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import type { Project } from '@/lib/types'
import { updateProject, markCompleted, markPaid, cancelProject, deleteProject, approveCompletion, rescheduleProject } from './actions'
import { submitRating } from './rating-actions'
import { addAttachment, removeAttachment, getAttachmentUrl } from './attachment-actions'
import { sendMessage, getMessages } from './message-actions'
import { addChangeOrder, deleteChangeOrder } from './change-order-actions'
import InviteSubsModal from './InviteSubsModal'
import StarRating from '@/components/StarRating'
import DatePicker from '@/components/DatePicker'
import ProjectPhotos from '@/components/ProjectPhotos'
import BackupButton from '@/components/BackupButton'
import BackupToDriveButton from '@/components/BackupToDriveButton'
import DoorActivityPanel from '@/components/DoorActivityPanel'
import type { SubRating, ProjectAttachment, PhotoWithUrl, DoorKnock } from '@/lib/types'

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

interface ChangeOrderWithName {
  id: string
  project_id: string
  amount: number
  description: string
  previous_payout: number
  new_payout: number
  created_at: string
  created_by_name: string
}

interface ProjectDetailClientProps {
  project: Project
  invitations: InvitationWithName[]
  acceptedByUser: { first_name: string; last_name: string; email: string; company_name: string | null; display_name: string } | null
  tenantName: string
  tenantId: string
  tenantPlan: string
  existingRating: SubRating | null
  attachments: ProjectAttachment[]
  messages: MessageWithSender[]
  changeOrders: ChangeOrderWithName[]
  currentUserId: string
  photos: PhotoWithUrl[]
  driveConnected: boolean
  doorKnocks: DoorKnock[]
  doorClockedMinutes: number
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
  changeOrders,
  currentUserId,
  photos,
  driveConnected,
  doorKnocks,
  doorClockedMinutes,
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
  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  // Change order modal state
  const [showChangeOrderModal, setShowChangeOrderModal] = useState(false)
  const [changeOrderError, setChangeOrderError] = useState<string | null>(null)

  const hasAssignedSub = !!project.accepted_by
  const canReschedule = !['paid', 'cancelled'].includes(project.status)
  const hasScheduleChange = !!project.schedule_changed_at
  // Change orders are sorted newest first; the oldest entry's previous_payout is
  // the project's original (base) payout before any adjustments.
  const canChangeOrder = !['paid', 'cancelled', 'imported'].includes(project.status)
  const originalPayout = changeOrders.length > 0
    ? changeOrders[changeOrders.length - 1].previous_payout
    : project.payout_amount
  const totalAdjustments = changeOrders.reduce((sum, co) => sum + co.amount, 0)

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
    if (!confirm('Cancel this project? Subs will no longer see it and it cannot be re-listed (a new project would have to be created).')) return
    startTransition(async () => {
      const result = await cancelProject(project.id, project.version)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.info('Project cancelled.'); router.refresh() }
    })
  }

  const handleSubmitRating = () => {
    if (ratingValue < 1) return
    clearMessages()
    startTransition(async () => {
      const result = await submitRating(project.id, ratingValue, ratingNote || null)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success('Rating submitted.'); setShowRatingModal(false); router.refresh() }
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

  const handleReschedule = (formData: FormData) => {
    setRescheduleError(null)
    startTransition(async () => {
      const result = await rescheduleProject(project.id, formData)
      if (result?.error) {
        setRescheduleError(result.error)
        toast.error(result.error)
      } else {
        if (result?.subNotified) {
          toast.success('Schedule updated. The assigned subcontractor has been emailed.')
        } else {
          toast.success('Schedule updated.')
        }
        setShowRescheduleModal(false)
        router.refresh()
      }
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

  const handleAddChangeOrder = (formData: FormData) => {
    setChangeOrderError(null)
    startTransition(async () => {
      const result = await addChangeOrder(project.id, formData)
      if (result?.error) {
        setChangeOrderError(result.error)
        toast.error(result.error)
      } else {
        toast.success(result?.subNotified
          ? 'Change order added. The assigned subcontractor has been emailed.'
          : 'Change order added.')
        setShowChangeOrderModal(false)
        router.refresh()
      }
    })
  }

  const handleDeleteChangeOrder = (changeOrderId: string) => {
    if (!confirm('Remove this change order? Its amount will be reversed out of the payout.')) return
    startTransition(async () => {
      const result = await deleteChangeOrder(changeOrderId)
      if (result?.error) { setError(result.error); toast.error(result.error) }
      else { toast.success('Change order removed.'); router.refresh() }
    })
  }

  return (
    <AppShell variant="admin" companyName={tenantName}>

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

          {hasScheduleChange && (
            <div className="mb-6 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-yellow-700 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">Schedule changed</p>
                  <p className="mt-1 text-sm text-yellow-800">
                    Moved from <span className="line-through">{formatDateTime(project.previous_start_date, project.previous_start_time)}</span>
                    {' '}to <span className="font-semibold">{formatDateTime(project.start_date, project.start_time)}</span>
                    {' '}on {formatDate(project.schedule_changed_at)}.
                  </p>
                  {hasAssignedSub && (
                    <p className="mt-1 text-xs text-yellow-700">
                      {project.schedule_change_acknowledged_at
                        ? `Subcontractor acknowledged on ${formatDate(project.schedule_change_acknowledged_at)}.`
                        : 'The assigned subcontractor was emailed and has not yet acknowledged the change.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  <DatePicker name="start_date" defaultValue={project.start_date} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" name="start_time" defaultValue={project.start_time ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {project.project_type === 'door_to_door' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($/hr) *</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" name="hourly_rate" required min="0.01" step="0.01" defaultValue={project.hourly_rate ?? ''}
                        className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Door-to-door job — pay is clocked hours × this rate.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payout Amount *</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" name="payout_amount" required min="0" step="0.01" defaultValue={project.payout_amount}
                        className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Labor Hours</label>
                  <input type="number" name="estimated_labor_hours" min="0" step="0.01" defaultValue={project.estimated_labor_hours ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Revenue ($)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" name="revenue_amount" min="0" step="0.01" defaultValue={project.revenue_amount ?? ''}
                      className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">What the customer pays you — powers marketing ROI.</p>
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
                {project.project_type === 'door_to_door' ? (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pay</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {project.hourly_rate != null ? `${formatCurrency(project.hourly_rate)}/hr` : 'Hourly'}
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">Door to door</span>
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payout Amount</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(project.payout_amount)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Estimated Labor Hours</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project.estimated_labor_hours != null ? Number(project.estimated_labor_hours).toFixed(2) : '—'}</dd>
                </div>
                {project.revenue_amount != null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Customer Revenue</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(project.revenue_amount))}
                      {project.project_type !== 'door_to_door' && Number(project.revenue_amount) > 0 && (
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          {formatCurrency(Number(project.revenue_amount) - Number(project.payout_amount))} gross after payout
                        </span>
                      )}
                    </dd>
                  </div>
                )}
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
                  <p className="text-sm font-medium text-yellow-800">Accepted by: {acceptedByUser.display_name}</p>
                  <p className="text-sm text-yellow-700">
                    {acceptedByUser.company_name ? `${acceptedByUser.first_name} ${acceptedByUser.last_name} · ` : ''}{acceptedByUser.email}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {project.status === 'available' && (
                  <>
                    <Tooltip text="Edit this job's details, pay, or schedule.">
                      <button onClick={() => { setEditing(true); clearMessages() }}
                        className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Edit</button>
                    </Tooltip>
                    <Tooltip text="Send this job to subcontractors so they can accept it.">
                      <button onClick={() => setShowInviteModal(true)}
                        className="inline-flex items-center rounded-md bg-white border border-ember/30 px-4 py-2 text-sm font-semibold text-ember hover:bg-ember/10">Invite Subs</button>
                    </Tooltip>
                    <Tooltip text="Permanently remove this job. This can't be undone.">
                      <button onClick={handleDelete} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Delete</button>
                    </Tooltip>
                  </>
                )}
                {(project.status === 'accepted' || project.status === 'in_progress') && (
                  <>
                    <Tooltip text="Mark the work done. Moves the job to completed.">
                      <button onClick={handleMarkCompleted} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                        {isPending ? 'Processing...' : 'Mark Completed'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Record that you've paid the sub. They'll be notified.">
                      <button onClick={handleMarkPaid} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                        {isPending ? 'Processing...' : 'Mark Paid'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Cancel this job. Subs will no longer see it.">
                      <button onClick={handleCancel} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Cancel</button>
                    </Tooltip>
                  </>
                )}
                {project.status === 'pending_completion' && (
                  <>
                    <Tooltip text="Confirm the sub finished the job and mark it completed.">
                      <button onClick={handleApproveCompletion} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                        {isPending ? 'Processing...' : 'Approve Completion'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Record that you've paid the sub. They'll be notified.">
                      <button onClick={handleMarkPaid} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                        {isPending ? 'Processing...' : 'Mark Paid'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Cancel this job. Subs will no longer see it.">
                      <button onClick={handleCancel} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Cancel</button>
                    </Tooltip>
                  </>
                )}
                {project.status === 'completed' && (
                  <>
                    <Tooltip text="Record that you've paid the sub. They'll be notified.">
                      <button onClick={handleMarkPaid} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                        {isPending ? 'Processing...' : 'Mark Paid'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Cancel this job. Subs will no longer see it.">
                      <button onClick={handleCancel} disabled={isPending}
                        className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Cancel</button>
                    </Tooltip>
                  </>
                )}
                {project.status === 'cancelled' && (
                  <button onClick={handleDelete} disabled={isPending}
                    className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Delete</button>
                )}
                {canReschedule && (
                  <Tooltip text="Change the start date or time. The assigned sub gets emailed.">
                    <button
                      onClick={() => { setRescheduleError(null); setShowRescheduleModal(true) }}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      Reschedule
                    </button>
                  </Tooltip>
                )}
                <BackupButton projectId={project.id} />
                {driveConnected && <BackupToDriveButton projectId={project.id} />}
              </div>
            </>
          )}
        </div>

        {/* Change Orders — adjust scope & pay at any point */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Change Orders</h2>
              <p className="text-sm text-gray-500">Adjust scope and pay — every change is logged so there's no confusion.</p>
            </div>
            {canChangeOrder && (
              <Tooltip text="Adjust the scope and pay after the job is posted. The change is logged.">
                <button
                  onClick={() => { setChangeOrderError(null); setShowChangeOrderModal(true) }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Change Order
                </button>
              </Tooltip>
            )}
          </div>

          {/* Payout breakdown */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Original payout</span>
              <span className="font-medium text-gray-900">{formatCurrency(originalPayout)}</span>
            </div>
            {changeOrders.length > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Change orders ({changeOrders.length})</span>
                <span className={`font-medium ${totalAdjustments >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {totalAdjustments >= 0 ? '+' : '−'}{formatCurrency(Math.abs(totalAdjustments))}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-base mt-2 pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-900">Current total payout</span>
              <span className="font-bold text-gray-900">{formatCurrency(project.payout_amount)}</span>
            </div>
          </div>

          {changeOrders.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {changeOrders.map((co) => (
                <li key={co.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{co.description}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(co.created_at)} · {co.created_by_name} · new total {formatCurrency(co.new_payout)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className={`text-sm font-semibold ${co.amount >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                        {co.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(co.amount))}
                      </span>
                      {project.status !== 'paid' && (
                        <button
                          onClick={() => handleDeleteChangeOrder(co.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No change orders yet. Add one when scope or pay changes after the job is posted.</p>
          )}
        </div>

        {/* Door-to-door activity — rep canvassing stats, pins, and knock log */}
        {project.project_type === 'door_to_door' && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Door-to-Door Activity</h2>
            <DoorActivityPanel
              knocks={doorKnocks}
              clockedMinutes={doorClockedMinutes}
              hourlyRate={project.hourly_rate != null ? Number(project.hourly_rate) : null}
            />
          </div>
        )}

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
              <Tooltip text="Attach a PDF, JPG, or PNG (up to 3) the sub can download.">
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
              </Tooltip>
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
                    <Tooltip text="Open or save this file." position="left">
                      <button
                        onClick={() => handleDownloadAttachment(att.id)}
                        className="text-xs font-medium text-ember hover:text-primary-700"
                      >
                        Download
                      </button>
                    </Tooltip>
                    <Tooltip text="Delete this file from the job. The sub won't see it anymore." position="left">
                      <button
                        onClick={() => handleRemoveAttachment(att.id)}
                        disabled={isPending}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700"
                      >
                        Remove
                      </button>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No documents attached. Add up to 3 files (PDF, JPG, PNG).</p>
          )}
        </div>

        {/* Jobsite Photos */}
        <ProjectPhotos
          projectId={project.id}
          tenantId={tenantId}
          initialPhotos={photos}
          canDelete={true}
          currentUserId={currentUserId}
        />

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

      {showChangeOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Change Order</h3>
              <p className="mt-1 text-sm text-gray-500">
                Current payout is <span className="font-medium text-gray-700">{formatCurrency(project.payout_amount)}</span>. Use a negative amount to reduce pay.
              </p>
            </div>
            <form action={handleAddChangeOrder} className="px-6 py-5 space-y-5">
              {hasAssignedSub && acceptedByUser && (
                <div className="rounded-md border-2 border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 flex-shrink-0 text-amber-700 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-900">This project has an assigned subcontractor</p>
                      <p className="mt-1 text-sm text-amber-800">
                        <strong>{acceptedByUser.display_name}</strong> will be emailed the new scope and total payout.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount *</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    name="amount"
                    required
                    step="0.01"
                    placeholder="e.g. 250 or -100"
                    className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Positive adds scope/pay; negative reduces it.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What changed? *</label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  placeholder="e.g. Added gutter replacement on the north side."
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                />
              </div>

              {changeOrderError && (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{changeOrderError}</div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : hasAssignedSub ? 'Save & Notify Sub' : 'Save Change Order'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChangeOrderModal(false); setChangeOrderError(null) }}
                  className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Reschedule Project</h3>
              <p className="mt-1 text-sm text-gray-500">
                Currently scheduled for <span className="font-medium text-gray-700">{formatDateTime(project.start_date, project.start_time)}</span>.
              </p>
            </div>
            <form action={handleReschedule} className="px-6 py-5 space-y-5">
              {hasAssignedSub && acceptedByUser && (
                <div className="rounded-md border-2 border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 flex-shrink-0 text-amber-700 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-900">Heads up: this project has an assigned subcontractor</p>
                      <p className="mt-1 text-sm text-amber-800">
                        <strong>{acceptedByUser.display_name}</strong> has accepted this job.
                        Saving will email them the new schedule and flag the change on their dashboard. Please also follow up directly to make sure they got it.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Start Date *</label>
                  <DatePicker name="start_date" defaultValue={project.start_date} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Start Time</label>
                  <input
                    type="time"
                    name="start_time"
                    defaultValue={project.start_time ?? ''}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                  />
                </div>
              </div>

              {rescheduleError && (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{rescheduleError}</div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : hasAssignedSub ? 'Save & Notify Sub' : 'Save Schedule'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRescheduleModal(false); setRescheduleError(null) }}
                  className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
