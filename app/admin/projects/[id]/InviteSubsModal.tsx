'use client'

import { useState, useEffect, useTransition } from 'react'
import { getSubcontractors, sendInvitations } from './invite-actions'

interface Sub {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name: string | null
  compliant: boolean
}

interface InviteSubsModalProps {
  projectId: string
  tenantId: string
  existingInvitationSubIds: string[]
  onClose: () => void
}

export default function InviteSubsModal({
  projectId,
  tenantId,
  existingInvitationSubIds,
  onClose,
}: InviteSubsModalProps) {
  const [subs, setSubs] = useState<Sub[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await getSubcontractors(tenantId)
        if (result.error) {
          setError(result.error)
        }
        setSubs(result.data ?? [])
      } catch {
        setError('Failed to load subcontractors.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId])

  // Only show compliant subs that haven't been invited yet
  const availableSubs = subs.filter((s) => !existingInvitationSubIds.includes(s.id) && s.compliant)
  const nonCompliantSubs = subs.filter((s) => !existingInvitationSubIds.includes(s.id) && !s.compliant)

  const toggleSub = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === availableSubs.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(availableSubs.map((s) => s.id)))
    }
  }

  const handleSend = () => {
    setError(null)
    startTransition(async () => {
      const result = await sendInvitations(projectId, Array.from(selected), expiresInDays)
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Invite Subcontractors</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-amber-50 p-3">
              <p className="text-sm text-amber-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-ember border-t-transparent" />
              <span className="ml-2 text-sm text-gray-500">Loading subcontractors...</span>
            </div>
          ) : availableSubs.length === 0 && nonCompliantSubs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">
                {subs.length === 0 ? 'No active subcontractors found.' : 'All subcontractors have already been invited.'}
              </p>
            </div>
          ) : (
            <>
              {availableSubs.length > 0 && (
                <>
                  <label className="flex items-center gap-3 py-2 mb-2 border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={selected.size === availableSubs.length && availableSubs.length > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-ember focus:ring-ember"
                    />
                    <span className="text-sm font-medium text-gray-700">Select All</span>
                  </label>

                  <ul className="space-y-1">
                    {availableSubs.map((sub) => (
                      <li key={sub.id}>
                        <label className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(sub.id)}
                            onChange={() => toggleSub(sub.id)}
                            className="h-4 w-4 rounded border-gray-300 text-ember focus:ring-ember"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {sub.first_name} {sub.last_name}
                            </p>
                            {sub.company_name && (
                              <p className="text-xs text-gray-500 truncate">{sub.company_name}</p>
                            )}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Non-compliant subs shown as unavailable */}
              {nonCompliantSubs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-amber-500 uppercase tracking-wide mb-2">
                    Not Eligible (Missing W-9/COI or Expired Insurance)
                  </p>
                  <ul className="space-y-1">
                    {nonCompliantSubs.map((sub) => (
                      <li key={sub.id} className="flex items-center gap-3 px-2 py-1.5 opacity-50">
                        <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300" />
                        <span className="text-sm text-gray-500">
                          {sub.first_name} {sub.last_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expiration picker */}
              {availableSubs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Invitation Expires In
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember"
                  >
                    <option value={3}>3 days</option>
                    <option value={7}>7 days (default)</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
              )}

              {/* Already invited */}
              {existingInvitationSubIds.length > 0 && subs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Already Invited</p>
                  <ul className="space-y-1">
                    {subs
                      .filter((s) => existingInvitationSubIds.includes(s.id))
                      .map((sub) => (
                        <li key={sub.id} className="flex items-center gap-3 px-2 py-1.5 opacity-50">
                          <input type="checkbox" checked disabled className="h-4 w-4 rounded border-gray-300" />
                          <span className="text-sm text-gray-500">{sub.first_name} {sub.last_name}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={isPending || selected.size === 0}
            className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {isPending ? 'Sending...' : `Send Invites (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
