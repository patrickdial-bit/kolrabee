'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/AdminNav'
import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import Tooltip from '@/components/Tooltip'
import { formatCurrency, formatInsuranceDate } from '@/lib/utils'
import { isSubCompliant } from '@/lib/types'
import { softDeleteSub, reactivateSub, inviteSubToJoin } from './actions'
import { getDocumentUrl } from './[id]/doc-actions'
import type { SubcontractorWithStats } from '@/lib/types'

type SubSortKey = 'company_name' | 'first_name' | 'last_name' | 'email' | 'crew_size' | 'insurance_expiration' | 'insurance_provider' | 'phone' | 'years_in_business'
type SortDir = 'asc' | 'desc'

interface Props {
  subcontractors: SubcontractorWithStats[]
  tenantName: string
  tenantSlug: string
}

export default function SubcontractorListClient({ subcontractors, tenantName, tenantSlug }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('active')
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'not_compliant'>('all')
  const [sortKey, setSortKey] = useState<SubSortKey>('last_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleSort = useCallback((key: SubSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])
  const [docLoading, setDocLoading] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const filtered = useMemo(() => {
    let result = subcontractors

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }

    // Compliance filter
    if (complianceFilter === 'compliant') {
      result = result.filter((s) => isSubCompliant(s))
    } else if (complianceFilter === 'not_compliant') {
      result = result.filter((s) => !isSubCompliant(s))
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((s) => {
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
        return (
          fullName.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.phone && s.phone.toLowerCase().includes(q)) ||
          (s.company_name && s.company_name.toLowerCase().includes(q))
        )
      })
    }

    // Sort
    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const strCmp = (x: string | null | undefined, y: string | null | undefined) =>
        dir * (x ?? '').localeCompare(y ?? '')
      const numCmp = (x: number | null | undefined, y: number | null | undefined) =>
        dir * ((x ?? 0) - (y ?? 0))

      switch (sortKey) {
        case 'company_name': return strCmp(a.company_name, b.company_name)
        case 'first_name': return strCmp(a.first_name, b.first_name)
        case 'last_name': return strCmp(a.last_name, b.last_name)
        case 'email': return strCmp(a.email, b.email)
        case 'crew_size': return numCmp(a.crew_size, b.crew_size)
        case 'insurance_expiration': return strCmp(a.insurance_expiration, b.insurance_expiration)
        case 'insurance_provider': return strCmp(a.insurance_provider, b.insurance_provider)
        case 'phone': return strCmp(a.phone, b.phone)
        case 'years_in_business': return numCmp(a.years_in_business, b.years_in_business)
        default: return 0
      }
    })

    return result
  }, [subcontractors, search, statusFilter, complianceFilter, sortKey, sortDir])

  function handleDelete(userId: string) {
    startTransition(async () => {
      await softDeleteSub(userId)
      setConfirmDeleteId(null)
    })
  }

  function handleReactivate(userId: string) {
    startTransition(async () => {
      await reactivateSub(userId)
    })
  }

  function handleInvite() {
    setInviteError('')
    if (!inviteEmail.trim()) {
      setInviteError('Email is required.')
      return
    }
    startTransition(async () => {
      const result = await inviteSubToJoin(inviteEmail, inviteName)
      if (result.error) {
        setInviteError(result.error)
      } else {
        setInviteSuccess(true)
        setInviteEmail('')
        setInviteName('')
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

  async function handleViewDoc(subId: string, docType: 'w9' | 'coi') {
    const key = `${subId}-${docType}`
    setDocLoading(key)
    const result = await getDocumentUrl(subId, docType)
    setDocLoading(null)
    if (result.url) {
      window.open(result.url, '_blank')
    }
  }

  const subsTourSteps: TourStep[] = [
    {
      target: '#tour-invite-sub',
      title: 'Invite a Subcontractor',
      content: 'Send an email invitation to a subcontractor. They\'ll create an account, upload their W-9 and COI, and then be available for project invites.',
      placement: 'bottom',
    },
    {
      target: '#tour-sub-filters',
      title: 'Search & Filter',
      content: 'Search by name, email, or company. Filter by status (Active/Deleted) or compliance (Compliant/Not Compliant).',
      placement: 'bottom',
    },
    {
      target: '#tour-sub-table',
      title: 'Subcontractor List',
      content: 'Click column headers to sort. Green checkmarks mean W-9 or COI is on file. Click Edit to see their full profile, documents, and project history.',
      placement: 'top',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenantName} />

      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">All Subcontractors</h1>
              <p className="mt-1 text-sm text-gray-500">
                {subcontractors.filter(s => s.status === 'active').length} active subcontractor{subcontractors.filter(s => s.status === 'active').length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-3">
              <button
                id="tour-invite-sub"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Invite Subcontractor
              </button>
            </div>
          </div>

          {/* Filters row */}
          <div id="tour-sub-filters" className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-48 sm:w-64 rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="deleted">Deleted</option>
            </select>
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
            >
              <option value="all">All Compliance</option>
              <option value="compliant">Compliant</option>
              <option value="not_compliant">Not Compliant</option>
            </select>
            <span className="text-xs text-gray-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <h3 className="text-sm font-semibold text-gray-900">
              {search ? 'No subcontractors found' : 'No subcontractors yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search ? 'Try adjusting your search terms.' : 'Subcontractors will appear here once they sign up.'}
            </p>
          </div>
        ) : (
          <div id="tour-sub-table" className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-forest">
                <tr>
                  <SubSortTh label="Company Name" sortKey="company_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SubSortTh label="First Name" sortKey="first_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SubSortTh label="Last Name" sortKey="last_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SubSortTh label="Email" sortKey="email" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SubSortTh label="Crew" sortKey="crew_size" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                  <SubSortTh label="Insurance Exp." sortKey="insurance_expiration" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                  <SubSortTh label="Insurance Provider" sortKey="insurance_provider" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Address</th>
                  <SubSortTh label="Phone" sortKey="phone" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SubSortTh label="Years" sortKey="years_in_business" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">COI</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">W-9</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Edit</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((sub) => {
                  const insuranceInfo = formatInsuranceDate(sub.insurance_expiration)
                  return (
                    <tr key={sub.id} className={`hover:bg-gray-50 transition-colors ${sub.status === 'deleted' ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sub.company_name || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.first_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.last_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">{sub.crew_size ?? '—'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-medium ${insuranceInfo.isExpired ? 'text-amber-600 bg-amber-50' : 'text-gray-600'}`}>
                        {insuranceInfo.text}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.insurance_provider || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">{sub.address || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sub.phone ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">{sub.years_in_business ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {sub.coi_file_url ? (
                          <button
                            onClick={() => handleViewDoc(sub.id, 'coi')}
                            disabled={docLoading === `${sub.id}-coi`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {docLoading === `${sub.id}-coi` ? '...' : 'View'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100">
                            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {sub.w9_file_url ? (
                          <button
                            onClick={() => handleViewDoc(sub.id, 'w9')}
                            disabled={docLoading === `${sub.id}-w9`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {docLoading === `${sub.id}-w9` ? '...' : 'View'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100">
                            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Link href={`/admin/subcontractors/${sub.id}`} className="text-amber-600 hover:text-amber-800">
                          <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                          </svg>
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {sub.status === 'active' ? (
                          confirmDeleteId === sub.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleDelete(sub.id)} disabled={isPending}
                                className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-forest disabled:opacity-50">
                                {isPending ? '...' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} disabled={isPending}
                                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                                No
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(sub.id)}
                              className="text-amber-600 hover:text-amber-800">
                              <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          )
                        ) : (
                          <button onClick={() => handleReactivate(sub.id)} disabled={isPending}
                            className="rounded bg-ember/10 px-2 py-1 text-xs text-ember hover:bg-ember/15 disabled:opacity-50">
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
        )}
      </div>

      {/* Invite Subcontractor Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeInviteModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            {inviteSuccess ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Invitation Sent!</h3>
                  <p className="text-sm text-gray-500 mb-6">They'll receive an email with a link to create their account.</p>
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
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Invite Subcontractor</h3>
                <p className="text-sm text-gray-500 mb-5">Send an email inviting them to create a Kolrabee account.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-amber-500">*</span></label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
                      placeholder="sub@example.com"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none"
                    />
                  </div>

                  {inviteError && (
                    <p className="text-sm text-amber-600">{inviteError}</p>
                  )}
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

      {/* Guided tour for first-time users */}
      <GuidedTour steps={subsTourSteps} tourKey="admin-subcontractors" />
    </div>
  )
}

function SubSortTh({ label, sortKey: key, currentKey, dir, onSort, align }: {
  label: string; sortKey: SubSortKey; currentKey: SubSortKey; dir: SortDir
  onSort: (k: SubSortKey) => void; align: 'left' | 'right' | 'center'
}) {
  const active = key === currentKey
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white cursor-pointer select-none hover:bg-forest-700 transition-colors ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          {active && dir === 'desc'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />}
        </svg>
      </span>
    </th>
  )
}
