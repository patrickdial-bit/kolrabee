'use client'

import { useState } from 'react'
import Link from 'next/link'
import SubNav from '@/components/SubNav'
import Tooltip from '@/components/Tooltip'
import { useI18n } from '@/lib/i18n'
import { extractCity, formatCurrency, formatDate } from '@/lib/utils'
import type { Project, ProjectInvitation } from '@/lib/types'
import { acceptProject, cancelAcceptedProject, declineProject, requestCompletion } from './actions'
import { sendSubMessage, getSubAttachmentUrl } from './message-actions'
import type { ProjectAttachment } from '@/lib/types'

interface MessageWithSender {
  id: string
  sender_id: string
  body: string
  created_at: string
  sender_name: string
}

interface SubProjectDetailClientProps {
  slug: string
  tenantName: string
  subName: string
  project: Project
  invitation: ProjectInvitation | null
  isAcceptedByMe: boolean
  attachments: ProjectAttachment[]
  messages: MessageWithSender[]
  currentUserId: string
}

const statusBadgeClasses: Record<string, string> = {
  available: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  pending_completion: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

const statusLabels: Record<string, string> = {
  available: 'Available',
  accepted: 'Accepted',
  pending_completion: 'Pending Approval',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export default function SubProjectDetailClient({
  slug,
  tenantName,
  subName,
  project,
  invitation,
  isAcceptedByMe,
  attachments,
  messages,
  currentUserId,
}: SubProjectDetailClientProps) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [messagePending, setMessagePending] = useState(false)

  // Determine visibility
  const isExpired = invitation?.expires_at ? new Date(invitation.expires_at) < new Date() : false
  const isBeforeAcceptance =
    project.status === 'available' && invitation?.status === 'invited' && !isAcceptedByMe && !isExpired
  const showFullDetails = isAcceptedByMe

  async function handleAccept() {
    setError(null)
    setLoading('accept')
    try {
      const result = await acceptProject(project.id, project.version, slug)
      if (result?.error) {
        setError(result.error)
        setShowAcceptConfirm(false)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  async function handleDecline() {
    setError(null)
    setLoading('decline')
    try {
      const result = await declineProject(project.id, slug)
      if (result?.error) {
        setError(result.error)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  async function handleMarkComplete() {
    setError(null)
    setLoading('complete')
    try {
      const result = await requestCompletion(project.id, project.version, slug)
      if (result?.error) {
        setError(result.error)
        setShowCompleteConfirm(false)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  async function handleSendMessage() {
    if (!messageText.trim()) return
    setMessagePending(true)
    setError(null)
    try {
      const result = await sendSubMessage(project.id, messageText.trim(), slug)
      if (result?.error) setError(result.error)
      else setMessageText('')
    } catch {
      setError('Failed to send message.')
    } finally {
      setMessagePending(false)
    }
  }

  async function handleDownloadAttachment(attachmentId: string) {
    const result = await getSubAttachmentUrl(attachmentId, slug)
    if (result?.error) setError(result.error)
    else if (result?.url) window.open(result.url, '_blank')
  }

  async function handleCancel() {
    setError(null)
    setLoading('cancel')
    try {
      const result = await cancelAcceptedProject(project.id, project.version, slug)
      if (result?.error) {
        setError(result.error)
        setShowCancelConfirm(false)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SubNav slug={slug} tenantName={tenantName} subName={subName} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href={`/${slug}/dashboard`}
          className="inline-flex items-center gap-1 text-sm font-medium text-ember hover:text-ember transition-colors mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {t('project.back')}
        </Link>

        {error && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                {project.job_number && (
                  <p className="text-sm font-medium text-ember">#{project.job_number}</p>
                )}
                <h1 className="mt-1 text-xl font-bold text-gray-900">{project.customer_name}</h1>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses[project.status] || 'bg-gray-100 text-gray-700'}`}
              >
                {statusLabels[project.status] || project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.location')}</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {showFullDetails ? project.address : extractCity(project.address)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.start_date')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(project.start_date)}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.payout')}</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrency(project.payout_amount)}
                </dd>
              </div>

              {showFullDetails && project.accepted_at && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.accepted_date')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(project.accepted_at)}</dd>
                </div>
              )}

              {showFullDetails && project.paid_at && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.paid_date')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(project.paid_at)}</dd>
                </div>
              )}
            </div>

            {project.notes && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.notes')}</dt>
                <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</dd>
              </div>
            )}

            {showFullDetails && project.companycam_link && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.photos')}</dt>
                <dd className="mt-1">
                  <a
                    href={project.companycam_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ember hover:text-ember transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    {t('project.view_photos')}
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </dd>
              </div>
            )}
          </div>

          {/* Job Documents */}
          {attachments.length > 0 && (
            <div className="border-t border-gray-200 px-6 py-5">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{t('project.documents')}</dt>
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li key={att.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-sm text-gray-900">{att.file_name}</span>
                    </div>
                    <button
                      onClick={() => handleDownloadAttachment(att.id)}
                      className="text-xs font-medium text-ember hover:text-primary-700"
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Messages */}
          {isAcceptedByMe && (
            <div className="border-t border-gray-200 px-6 py-5">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{t('project.messages')}</dt>
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
                <p className="text-sm text-gray-500 mb-4">{t('project.message_placeholder')}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={t('project.message_placeholder')}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={messagePending || !messageText.trim()}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {messagePending ? t('project.sending_message') : t('project.send_message')}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            {/* Expired invitation */}
            {invitation?.status === 'invited' && isExpired && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-800">This invitation has expired.</p>
                <p className="text-xs text-amber-600 mt-1">Contact your contractor to request a new invitation.</p>
              </div>
            )}

            {/* Expiry countdown for active invitations */}
            {isBeforeAcceptance && invitation?.expires_at && (
              <p className="text-xs text-gray-500 mb-3">
                Expires {new Date(invitation.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}

            {/* Before acceptance: Accept + Decline */}
            {isBeforeAcceptance && !showAcceptConfirm && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAcceptConfirm(true)}
                  className="flex-1 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  {t('project.accept_job')}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={loading === 'decline'}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {loading === 'decline' ? t('project.declining') : t('project.decline')}
                </button>
              </div>
            )}

            {/* Accept confirmation dialog */}
            {isBeforeAcceptance && showAcceptConfirm && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">
                  {t('project.confirm_accept')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleAccept}
                    disabled={loading === 'accept'}
                    className="flex-1 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {loading === 'accept' ? t('action.accepting') : t('project.yes_accept')}
                  </button>
                  <button
                    onClick={() => setShowAcceptConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t('project.go_back')}
                  </button>
                </div>
              </div>
            )}

            {/* After acceptance, status='accepted': Mark Complete + Cancel buttons */}
            {isAcceptedByMe && project.status === 'accepted' && !showCancelConfirm && !showCompleteConfirm && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowCompleteConfirm(true)}
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                >
                  {t('project.mark_complete')}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  {t('project.cancel_acceptance')}
                </button>
              </div>
            )}

            {/* Mark Complete confirmation */}
            {isAcceptedByMe && project.status === 'accepted' && showCompleteConfirm && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">
                  {t('project.confirm_complete')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleMarkComplete}
                    disabled={loading === 'complete'}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading === 'complete' ? t('project.completing') : t('project.yes_complete')}
                  </button>
                  <button
                    onClick={() => setShowCompleteConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t('project.go_back')}
                  </button>
                </div>
              </div>
            )}

            {/* Pending completion — awaiting owner approval */}
            {isAcceptedByMe && project.status === 'pending_completion' && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <p className="text-sm font-medium text-orange-800">{t('project.awaiting_approval')}</p>
                <p className="text-xs text-orange-600 mt-1">{t('project.awaiting_approval_desc')}</p>
              </div>
            )}

            {/* Cancel confirmation */}
            {isAcceptedByMe && project.status === 'accepted' && showCancelConfirm && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">
                  {t('project.confirm_cancel')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={loading === 'cancel'}
                    className="flex-1 rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest transition-colors disabled:opacity-50"
                  >
                    {loading === 'cancel' ? t('project.cancelling') : t('project.yes_cancel')}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t('project.go_back')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
