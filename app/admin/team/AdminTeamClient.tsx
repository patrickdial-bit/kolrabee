'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Tooltip from '@/components/Tooltip'
import { formatDate } from '@/lib/utils'
import {
  inviteAdminToJoin,
  removeAdmin,
  reactivateAdmin,
  revokeAdminInvite,
  inviteEstimatorToJoin,
  removeEstimator,
  reactivateEstimator,
  revokeEstimatorInvite,
} from './actions'

export type TeamAdmin = {
  id: string
  first_name: string
  last_name: string
  email: string
  status: 'active' | 'deleted'
  created_at: string
}

export type TeamInvite = {
  id: string
  email: string
  name: string | null
  invited_at: string
  expires_at: string
  status: string
}

interface Props {
  admins: TeamAdmin[]
  invites: TeamInvite[]
  estimators: TeamAdmin[]
  estimatorInvites: TeamInvite[]
  tenantName: string
  currentUserId: string
  ownerUserId: string | null
}

export default function AdminTeamClient({ admins, invites, estimators, estimatorInvites, tenantName, currentUserId, ownerUserId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteRole, setInviteRole] = useState<'admin' | 'estimator'>('admin')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const activeAdminCount = admins.filter((a) => a.status === 'active').length
  const activeEstimatorCount = estimators.filter((e) => e.status === 'active').length

  function handleInvite() {
    setInviteError('')
    if (!inviteEmail.trim()) {
      setInviteError('Email is required.')
      return
    }
    startTransition(async () => {
      const invite = inviteRole === 'estimator' ? inviteEstimatorToJoin : inviteAdminToJoin
      const result = await invite(inviteEmail, inviteName)
      if (result.error) {
        setInviteError(result.error)
        toast.error(result.error)
      } else {
        setInviteSuccess(true)
        setInviteEmail('')
        setInviteName('')
        toast.success(`${inviteRole === 'estimator' ? 'Estimator' : 'Admin'} invite sent to ${inviteEmail}!`)
      }
    })
  }

  function closeInviteModal() {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteName('')
    setInviteError('')
    setInviteSuccess(false)
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const result = await removeAdmin(userId)
      setConfirmRemoveId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Admin removed.')
      }
    })
  }

  function handleReactivate(userId: string) {
    startTransition(async () => {
      const result = await reactivateAdmin(userId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Admin reactivated.')
      }
    })
  }

  function handleRevokeInvite(inviteId: string, email: string) {
    startTransition(async () => {
      const result = await revokeAdminInvite(inviteId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Invite to ${email} revoked.`)
      }
    })
  }

  function handleResendInvite(email: string, name: string | null) {
    startTransition(async () => {
      const result = await inviteAdminToJoin(email, name ?? '')
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Resent admin invite to ${email}.`)
      }
    })
  }

  function handleRemoveEstimator(userId: string) {
    startTransition(async () => {
      const result = await removeEstimator(userId)
      setConfirmRemoveId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Estimator removed.')
      }
    })
  }

  function handleReactivateEstimator(userId: string) {
    startTransition(async () => {
      const result = await reactivateEstimator(userId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Estimator reactivated.')
      }
    })
  }

  function handleRevokeEstimatorInvite(inviteId: string, email: string) {
    startTransition(async () => {
      const result = await revokeEstimatorInvite(inviteId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Invite to ${email} revoked.`)
      }
    })
  }

  function handleResendEstimatorInvite(email: string, name: string | null) {
    startTransition(async () => {
      const result = await inviteEstimatorToJoin(email, name ?? '')
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Resent estimator invite to ${email}.`)
      }
    })
  }

  return (
    <AppShell variant="admin" companyName={tenantName}>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeAdminCount} active admin{activeAdminCount !== 1 ? 's' : ''}
              {invites.length > 0 && ` · ${invites.length} pending invite${invites.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            <Tooltip text="Email someone an invite to quote jobs — they only see their own quotes, nothing else">
              <button
                onClick={() => { setInviteRole('estimator'); setShowInviteModal(true) }}
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-forest/30 px-4 py-2.5 text-sm font-semibold text-forest hover:bg-forest/10 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Invite Estimator
              </button>
            </Tooltip>
            <Tooltip text="Email someone an invite to join as an admin who can manage projects, subs, and the team">
              <button
                onClick={() => { setInviteRole('admin'); setShowInviteModal(true) }}
                className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Invite Admin
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Admins list */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-forest">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {admins.map((a) => {
                const isSelf = a.id === currentUserId
                const isOwner = a.id === ownerUserId
                const isLastActive = a.status === 'active' && activeAdminCount <= 1
                const removeDisabledReason = isSelf
                  ? "You can't remove yourself"
                  : isOwner
                    ? "The account owner can't be removed"
                    : isLastActive
                      ? 'At least one active admin is required'
                      : null
                return (
                  <tr key={a.id} className={a.status === 'deleted' ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {a.first_name} {a.last_name}
                      {isSelf && <span className="ml-2 inline-flex items-center rounded-full bg-ember/10 px-2 py-0.5 text-xs font-medium text-ember">You</span>}
                      {isOwner && <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Owner</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{a.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm capitalize text-gray-600">{a.status === 'deleted' ? 'Removed' : 'Active'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {a.status === 'active' ? (
                        confirmRemoveId === a.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleRemove(a.id)}
                              disabled={isPending}
                              className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-forest disabled:opacity-50"
                            >
                              {isPending ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              disabled={isPending}
                              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <Tooltip text={removeDisabledReason ?? "Revoke this person's admin access to your account"}>
                            <button
                              onClick={() => setConfirmRemoveId(a.id)}
                              disabled={removeDisabledReason !== null}
                              className="text-amber-600 hover:text-amber-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                            >
                              Remove
                            </button>
                          </Tooltip>
                        )
                      ) : (
                        <button
                          onClick={() => handleReactivate(a.id)}
                          disabled={isPending}
                          className="rounded bg-ember/10 px-2 py-1 text-xs text-ember hover:bg-ember/15 disabled:opacity-50"
                        >
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

        {/* Pending invites */}
        {invites.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Pending Invites</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Invited</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Expires</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invites.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2.5 text-sm text-gray-900">
                        {inv.email}
                        {inv.name && <span className="text-gray-500"> ({inv.name})</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{formatDate(inv.invited_at)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{formatDate(inv.expires_at)}</td>
                      <td className="px-4 py-2.5 text-sm text-center space-x-3">
                        <Tooltip text="Send this admin invitation email again">
                          <button
                            onClick={() => handleResendInvite(inv.email, inv.name)}
                            disabled={isPending}
                            className="text-ember hover:text-primary-700 disabled:opacity-50"
                          >
                            Resend
                          </button>
                        </Tooltip>
                        <Tooltip text="Cancel this pending invite so the link no longer works">
                          <button
                            onClick={() => handleRevokeInvite(inv.id, inv.email)}
                            disabled={isPending}
                            className="text-amber-600 hover:text-amber-800 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Estimators — quote-only logins for the sales side */}
        <div className="mt-10">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Estimators</h2>
            <p className="text-sm text-gray-500">
              Estimators run bids through the profit guardrails before the contract goes out. They only see their own quotes — no projects, payouts, or team access.
              {activeEstimatorCount > 0 && ` ${activeEstimatorCount} active.`}
            </p>
          </div>
          {estimators.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-forest">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {estimators.map((e) => (
                    <tr key={e.id} className={e.status === 'deleted' ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{e.first_name} {e.last_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{e.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(e.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm capitalize text-gray-600">{e.status === 'deleted' ? 'Removed' : 'Active'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {e.status === 'active' ? (
                          confirmRemoveId === e.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleRemoveEstimator(e.id)}
                                disabled={isPending}
                                className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-forest disabled:opacity-50"
                              >
                                {isPending ? '...' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                disabled={isPending}
                                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <Tooltip text="Revoke this estimator's access. Their quotes are kept.">
                              <button
                                onClick={() => setConfirmRemoveId(e.id)}
                                className="text-amber-600 hover:text-amber-800"
                              >
                                Remove
                              </button>
                            </Tooltip>
                          )
                        ) : (
                          <button
                            onClick={() => handleReactivateEstimator(e.id)}
                            disabled={isPending}
                            className="rounded bg-ember/10 px-2 py-1 text-xs text-ember hover:bg-ember/15 disabled:opacity-50"
                          >
                            {isPending ? '...' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              No estimators yet. Invite one so quotes get a guardrail check before the contract goes out.
            </div>
          )}

          {estimatorInvites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Pending Estimator Invites</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Invited</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Expires</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {estimatorInvites.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2.5 text-sm text-gray-900">
                          {inv.email}
                          {inv.name && <span className="text-gray-500"> ({inv.name})</span>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{formatDate(inv.invited_at)}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{formatDate(inv.expires_at)}</td>
                        <td className="px-4 py-2.5 text-sm text-center space-x-3">
                          <Tooltip text="Send this estimator invitation email again">
                            <button
                              onClick={() => handleResendEstimatorInvite(inv.email, inv.name)}
                              disabled={isPending}
                              className="text-ember hover:text-primary-700 disabled:opacity-50"
                            >
                              Resend
                            </button>
                          </Tooltip>
                          <Tooltip text="Cancel this pending invite so the link no longer works">
                            <button
                              onClick={() => handleRevokeEstimatorInvite(inv.id, inv.email)}
                              disabled={isPending}
                              className="text-amber-600 hover:text-amber-800 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeInviteModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            {inviteSuccess ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Invitation Sent!</h3>
                <p className="text-sm text-gray-500 mb-6">They'll receive an email with a link to create their {inviteRole} account.</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setInviteSuccess(false); setInviteEmail(''); setInviteName('') }}
                    className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
                  >
                    Invite Another
                  </button>
                  <button
                    onClick={closeInviteModal}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {inviteRole === 'estimator' ? 'Invite Estimator' : 'Invite Admin'}
                </h3>
                <p className="text-sm text-gray-500 mb-5">
                  {inviteRole === 'estimator'
                    ? 'Estimators can create quotes and run the profit guardrails. They only see their own quotes.'
                    : 'Admins can post projects, invite subcontractors, and manage the team.'}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-amber-500">*</span></label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
                      placeholder="admin@example.com"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
                    />
                  </div>

                  {inviteError && <p className="text-sm text-amber-600">{inviteError}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={closeInviteModal}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={isPending}
                    className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
                  >
                    {isPending ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}
