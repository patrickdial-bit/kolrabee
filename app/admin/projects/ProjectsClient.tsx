'use client'

import { useState, useMemo, useCallback, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import StatusTabs from '@/components/StatusTabs'
import InviteSubsModal from '@/app/admin/projects/[id]/InviteSubsModal'
import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import Tooltip from '@/components/Tooltip'
import { formatCurrency, formatDateTime, hasResolvableCity } from '@/lib/utils'
import type { Project } from '@/lib/types'
import type { PlatformInvite, ProjectInviteSummary } from './page'
import ChatDrawer from '@/components/ChatDrawer'
import { sendMessage, getMessages } from '@/app/admin/projects/[id]/message-actions'
import { cancelSubInvite, editSubInvite } from '@/app/admin/subcontractors/actions'
import { clientSiteUrl } from '@/lib/site-url'

// A job address with no identifiable city can't be shown to a sub before they
// accept — they'd see the company's service area instead of the real location,
// and the job geocodes poorly on the map. Flag those so an admin can complete
// them; editing the job now asks for street/city/state/zip separately.
function AddressLine({ address }: { address: string }) {
  const incomplete = !hasResolvableCity(address)
  return (
    <p className="truncate text-xs text-gray-500">
      {address}
      {incomplete && (
        <span
          title="No city on this address — subs see the service area instead, and it won't map accurately. Edit the job to complete it."
          className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-300"
        >
          Incomplete address
        </span>
      )}
    </p>
  )
}

type SortKey = 'customer_name' | 'start_date' | 'payout_amount'
type SortDir = 'asc' | 'desc'

interface ProjectsClientProps {
  projects: Project[]
  subNameMap: Record<string, string>
  tenantName: string
  tenantId: string
  tenantSlug: string
  tenantPlan: string
  platformInvites: PlatformInvite[]
  currentUserId: string
  unreadCounts: Record<string, number>
  projectInvites: Record<string, ProjectInviteSummary[]>
  photoCounts: Record<string, number>
  initialTab: string
}

const STATUS_TABS = ['All', 'Available', 'Accepted', 'Completed', 'Paid']

// Workflow statuses that belong on the board (excludes cancelled + imported).
const PIPELINE_STATUSES: Project['status'][] = [
  'available', 'accepted', 'in_progress', 'pending_completion', 'completed', 'paid',
]

const STATUS_BADGE: Record<Project['status'], { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-slate-100 text-slate-700 ring-slate-600/20' },
  accepted: { label: 'Accepted', className: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 ring-blue-600/20' },
  pending_completion: { label: 'Pending Review', className: 'bg-indigo-100 text-indigo-700 ring-indigo-600/20' },
  completed: { label: 'Completed', className: 'bg-indigo-100 text-indigo-700 ring-indigo-600/20' },
  paid: { label: 'Paid', className: 'bg-primary-100 text-primary-700 ring-primary-600/20' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 ring-gray-500/20' },
  imported: { label: 'Imported', className: 'bg-gray-100 text-gray-500 ring-gray-500/20' },
}

function statusBadge(status: Project['status']) {
  return STATUS_BADGE[status] ?? { label: status, className: 'bg-gray-100 text-gray-500 ring-gray-500/20' }
}

// Schedule urgency hint for active jobs (Overdue / Today). Only meaningful while
// the work is live — available/paid jobs don't get a chip.
function scheduleHint(p: Project): { label: string; cls: string } | null {
  if (!p.start_date) return null
  if (p.status !== 'accepted' && p.status !== 'in_progress') return null
  const m = p.start_date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(p.start_date)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d < today) return { label: 'Overdue', cls: 'bg-red-50 text-red-700 ring-red-600/20' }
  if (d.getTime() === today.getTime()) return { label: 'Today', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
  return null
}

type MenuItem = { label: string; onClick: () => void; danger?: boolean }

export default function ProjectsClient({
  projects,
  subNameMap,
  tenantName,
  tenantId,
  tenantSlug,
  tenantPlan,
  platformInvites,
  currentUserId,
  unreadCounts: initialUnreadCounts,
  projectInvites,
  photoCounts,
  initialTab,
}: ProjectsClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [search, setSearch] = useState('')
  const [subFilter, setSubFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('start_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [chatProject, setChatProject] = useState<Project | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(initialUnreadCounts)
  const [editingInviteId, setEditingInviteId] = useState<string | null>(null)
  const [editInviteEmail, setEditInviteEmail] = useState('')
  const [editInviteName, setEditInviteName] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [, startInviteAction] = useTransition()
  const router = useRouter()

  function startEditInvite(invite: PlatformInvite) {
    setEditingInviteId(invite.id)
    setEditInviteEmail(invite.email)
    setEditInviteName(invite.name ?? '')
  }

  function cancelEditInvite() {
    setEditingInviteId(null)
    setEditInviteEmail('')
    setEditInviteName('')
  }

  function saveEditInvite(inviteId: string) {
    startInviteAction(async () => {
      const result = await editSubInvite(inviteId, editInviteEmail, editInviteName)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Invite updated and re-sent.')
        cancelEditInvite()
        router.refresh()
      }
    })
  }

  function handleCancelInvite(invite: PlatformInvite) {
    if (!confirm(`Cancel the invite for ${invite.email}?`)) return
    startInviteAction(async () => {
      const result = await cancelSubInvite(invite.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Invite for ${invite.email} cancelled.`)
        router.refresh()
      }
    })
  }

  const subLoginUrl = `${clientSiteUrl()}/${tenantSlug}/login`

  const copySubLoginLink = useCallback(() => {
    navigator.clipboard.writeText(`${clientSiteUrl()}/${tenantSlug}/login`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }, [tenantSlug])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    c['All'] = projects.filter((p) => PIPELINE_STATUSES.includes(p.status)).length
    c['Available'] = projects.filter((p) => p.status === 'available').length
    c['Accepted'] = projects.filter((p) => p.status === 'accepted' || p.status === 'in_progress').length
    c['Completed'] = projects.filter((p) => p.status === 'pending_completion' || p.status === 'completed').length
    c['Paid'] = projects.filter((p) => p.status === 'paid').length
    return c
  }, [projects])

  const totals = useMemo(() => {
    const sumPayout = (filter: (p: Project) => boolean) =>
      projects.filter(filter).reduce((sum, p) => sum + (p.payout_amount ?? 0), 0)
    return {
      Available: sumPayout((p) => p.status === 'available'),
      Accepted: sumPayout((p) => p.status === 'accepted' || p.status === 'in_progress'),
      Completed: sumPayout((p) => p.status === 'pending_completion' || p.status === 'completed'),
      Paid: sumPayout((p) => p.status === 'paid'),
    }
  }, [projects])

  // Subcontractors that appear as assignees — powers the "Assigned to" filter.
  const assignedSubs = useMemo(() => {
    const ids = new Set(projects.map((p) => p.accepted_by).filter((id): id is string => !!id))
    return Array.from(ids)
      .map((id) => ({ id, name: subNameMap[id] ?? 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, subNameMap])

  const filtered = useMemo(() => {
    let result: Project[]
    if (activeTab === 'Available') {
      result = projects.filter((p) => p.status === 'available')
    } else if (activeTab === 'Accepted') {
      result = projects.filter((p) => p.status === 'accepted' || p.status === 'in_progress')
    } else if (activeTab === 'Completed') {
      result = projects.filter((p) => p.status === 'pending_completion' || p.status === 'completed')
    } else if (activeTab === 'Paid') {
      result = projects.filter((p) => p.status === 'paid')
    } else {
      result = projects.filter((p) => PIPELINE_STATUSES.includes(p.status))
    }

    if (subFilter) {
      result = result.filter((p) => p.accepted_by === subFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          (p.job_number && p.job_number.toLowerCase().includes(q)) ||
          p.customer_name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'customer_name':
          return dir * a.customer_name.localeCompare(b.customer_name)
        case 'start_date': {
          if (!a.start_date && !b.start_date) return 0
          if (!a.start_date) return 1
          if (!b.start_date) return -1
          return dir * (new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        }
        case 'payout_amount':
          return dir * ((a.payout_amount ?? 0) - (b.payout_amount ?? 0))
        default:
          return 0
      }
    })

    return result
  }, [projects, activeTab, search, subFilter, sortKey, sortDir])

  const projectsTourSteps: TourStep[] = [
    {
      target: '#tour-add-project',
      title: 'Create a New Project',
      content: 'Click here to add a new project. Fill in the job details, payout, and any links to work orders or photos.',
      placement: 'bottom',
    },
    {
      target: '#tour-search-projects',
      title: 'Search & Filter',
      content: 'Find projects by customer, job number, or address, and narrow the list to a single subcontractor.',
      placement: 'bottom',
    },
    {
      target: '#tour-status-tabs',
      title: 'Track Each Stage',
      content: 'Move through your pipeline: Available → Accepted → Completed → Paid. The All tab shows every active job with its status.',
      placement: 'bottom',
    },
    {
      target: '#tour-project-table',
      title: 'Your Projects',
      content: 'Each row shows status, schedule, the assigned sub, and payout. Use the action button or the ⋯ menu to invite, chat, mark paid, or open the job.',
      placement: 'top',
    },
  ]

  // --- per-row action helpers ----------------------------------------------
  const open = useCallback((id: string) => router.push(`/admin/projects/${id}`), [router])

  function renderInviteSummary(projectId: string) {
    const invites = projectInvites[projectId] ?? []
    if (invites.length === 0) return <span className="text-xs text-gray-400">Not assigned</span>
    const pending = invites.filter((i) => i.status === 'invited')
    const declined = invites.filter((i) => i.status === 'declined')
    const tooltipParts: string[] = []
    if (pending.length > 0) tooltipParts.push(`Pending: ${pending.map((i) => i.subcontractor_name).join(', ')}`)
    if (declined.length > 0) tooltipParts.push(`Declined: ${declined.map((i) => i.subcontractor_name).join(', ')}`)
    const tooltipText = tooltipParts.join('  ·  ') || 'No invitations'
    return (
      <Tooltip text={tooltipText} position="bottom">
        <Link
          href={`/admin/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-ember whitespace-nowrap"
        >
          {pending.length > 0 && <span>{pending.length} invited</span>}
          {pending.length > 0 && declined.length > 0 && <span className="text-gray-300">·</span>}
          {declined.length > 0 && <span className="text-red-600">{declined.length} declined</span>}
        </Link>
      </Tooltip>
    )
  }

  function renderAssigned(project: Project) {
    if (project.status === 'available') return renderInviteSummary(project.id)
    if (project.accepted_by && subNameMap[project.accepted_by]) {
      return (
        <Link
          href={`/admin/subcontractors/${project.accepted_by}`}
          className="text-sm font-medium text-ember hover:text-primary-700"
        >
          {subNameMap[project.accepted_by]}
        </Link>
      )
    }
    return <span className="text-xs text-gray-400">—</span>
  }

  // The primary, status-aware call to action for a row.
  function renderPrimaryAction(project: Project) {
    const s = project.status
    if (s === 'available') {
      return (
        <button
          onClick={() => setInviteProjectId(project.id)}
          className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Invite
        </button>
      )
    }
    if (s === 'accepted' || s === 'in_progress') {
      return (
        <button
          onClick={() => setChatProject(project)}
          className="relative inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Chat
          {unreadCounts[project.id] > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCounts[project.id]}
            </span>
          )}
        </button>
      )
    }
    if (s === 'pending_completion' || s === 'completed') {
      return (
        <button
          onClick={() => open(project.id)}
          className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Mark paid
        </button>
      )
    }
    return (
      <button
        onClick={() => open(project.id)}
        className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Open
      </button>
    )
  }

  function menuItems(project: Project): MenuItem[] {
    const items: MenuItem[] = [{ label: 'Open project', onClick: () => open(project.id) }]
    const s = project.status
    if (s === 'available') {
      items.push({ label: 'Edit details', onClick: () => open(project.id) })
    } else if (s === 'accepted' || s === 'in_progress') {
      items.push({ label: 'Mark as paid', onClick: () => open(project.id) })
      items.push({ label: 'Cancel job', onClick: () => open(project.id), danger: true })
    } else if (s === 'pending_completion' || s === 'completed') {
      items.push({ label: 'Open chat', onClick: () => setChatProject(project) })
    }
    return items
  }

  const activeFilters = !!search.trim() || !!subFilter

  return (
    <AppShell variant="admin" companyName={tenantName}>
      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="mt-1 text-sm text-gray-500">Track every job from available through paid.</p>
          </div>
          <div className="flex items-center gap-3">
            <Tooltip text="Create a new project with job details, payout, and links">
              <Link
                id="tour-add-project"
                href="/admin/projects/new"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Project
              </Link>
            </Tooltip>
          </div>
        </div>

        {/* Stage summary — click a card to filter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StageCard label="Available" value={totals.Available} count={counts['Available']} active={activeTab === 'Available'} onClick={() => setActiveTab('Available')} dot="bg-slate-400" />
          <StageCard label="Accepted / In-Progress" value={totals.Accepted} count={counts['Accepted']} active={activeTab === 'Accepted'} onClick={() => setActiveTab('Accepted')} dot="bg-amber-500" />
          <StageCard label="Completed" value={totals.Completed} count={counts['Completed']} active={activeTab === 'Completed'} onClick={() => setActiveTab('Completed')} dot="bg-indigo-500" />
          <StageCard label="Total Paid" value={totals.Paid} count={counts['Paid']} active={activeTab === 'Paid'} onClick={() => setActiveTab('Paid')} dot="bg-primary-600" accent />
        </div>

        {/* Subcontractor onboarding (collapsible — keeps the access link + pending invites handy without cluttering the pipeline) */}
        {(tenantSlug || platformInvites.length > 0) && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => setShowOnboarding((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                Subcontractor access
                {platformInvites.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {platformInvites.length} pending invite{platformInvites.length === 1 ? '' : 's'}
                  </span>
                )}
              </span>
              <svg className={`h-5 w-5 text-gray-400 transition-transform ${showOnboarding ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showOnboarding && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                {tenantSlug && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Subcontractor Login Link</p>
                      <p className="text-sm text-gray-600 truncate">{subLoginUrl}</p>
                    </div>
                    <button
                      onClick={copySubLoginLink}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        linkCopied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {linkCopied ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                )}

                {platformInvites.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Invited</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {platformInvites.map((invite) => {
                          const isEditing = editingInviteId === invite.id
                          return (
                            <tr key={invite.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-sm text-gray-900">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editInviteName}
                                    onChange={(e) => setEditInviteName(e.target.value)}
                                    placeholder="Name (optional)"
                                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
                                  />
                                ) : (
                                  invite.name || '—'
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">
                                {isEditing ? (
                                  <input
                                    type="email"
                                    value={editInviteEmail}
                                    onChange={(e) => setEditInviteEmail(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
                                  />
                                ) : (
                                  invite.email
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-500">
                                {new Date(invite.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {isEditing ? (
                                  <div className="inline-flex items-center gap-2">
                                    <button onClick={() => saveEditInvite(invite.id)} className="rounded-md bg-ember px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700">Save</button>
                                    <button onClick={cancelEditInvite} className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200">Cancel</button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2">
                                    <button onClick={() => startEditInvite(invite)} className="rounded-md bg-ember/10 px-2.5 py-1 text-xs font-semibold text-ember hover:bg-ember/15">Edit</button>
                                    <button onClick={() => handleCancelInvite(invite)} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">Cancel invite</button>
                                  </div>
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
            )}
          </div>
        )}

        {/* Toolbar: tabs + filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div id="tour-status-tabs" className="min-w-0">
            <StatusTabs tabs={STATUS_TABS} activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
          </div>
          <div id="tour-search-projects" className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-44 sm:w-56 rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
              />
            </div>
            {assignedSubs.length > 0 && (
              <select
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-ember focus:ring-1 focus:ring-ember"
                aria-label="Filter by subcontractor"
              >
                <option value="">All subcontractors</option>
                {assignedSubs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Table */}
        <div id="tour-project-table" className="mt-4">
          {filtered.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="text-sm font-semibold text-gray-900">
                {activeFilters ? 'No matching projects' : `No ${activeTab === 'All' ? '' : activeTab.toLowerCase() + ' '}projects`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeFilters
                  ? 'Try clearing your search or filter.'
                  : activeTab === 'Available' || activeTab === 'All'
                    ? 'Get started by creating a new project.'
                    : `No ${activeTab.toLowerCase()} projects yet.`}
              </p>
              {activeFilters && (
                <button
                  onClick={() => { setSearch(''); setSubFilter('') }}
                  className="mt-4 inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((project) => {
                  const badge = statusBadge(project.status)
                  const hint = scheduleHint(project)
                  return (
                    <div key={project.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/admin/projects/${project.id}`} className="text-sm font-semibold text-gray-900 hover:text-ember">
                            {project.customer_name}
                            {project.job_number && <span className="ml-1 font-normal text-gray-400">#{project.job_number}</span>}
                          </Link>
                          <AddressLine address={project.address} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(project.payout_amount)}</span>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${badge.className}`}>{badge.label}</span>
                        {hint && <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${hint.cls}`}>{hint.label}</span>}
                        <span className="text-gray-500">{formatDateTime(project.start_date, project.start_time)}</span>
                      </div>
                      {project.status !== 'available' && project.accepted_by && subNameMap[project.accepted_by] && (
                        <p className="mb-3 text-xs text-gray-500">Assigned to <span className="font-medium text-ember">{subNameMap[project.accepted_by]}</span></p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderPrimaryAction(project)}
                        <Link href={`/admin/projects/${project.id}`} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          Details
                        </Link>
                        {project.status === 'available' && renderInviteSummary(project.id)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-forest">
                    <tr>
                      <SortTh label="Job" sortKey="customer_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Status</th>
                      <SortTh label="Schedule" sortKey="start_date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Assigned</th>
                      <SortTh label="Payout" sortKey="payout_amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white">Docs</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filtered.map((project) => {
                      const badge = statusBadge(project.status)
                      const hint = scheduleHint(project)
                      const photoCount = photoCounts[project.id] ?? 0
                      return (
                        <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                          {/* Job */}
                          <td className="px-4 py-3 max-w-[280px]">
                            <Link href={`/admin/projects/${project.id}`} className="text-sm font-medium text-gray-900 hover:text-ember">
                              {project.customer_name}
                              {project.job_number && <span className="ml-1 text-gray-400">#{project.job_number}</span>}
                            </Link>
                            <AddressLine address={project.address} />
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          {/* Schedule */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{formatDateTime(project.start_date, project.start_time)}</div>
                            {hint && (
                              <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${hint.cls}`}>
                                {hint.label}
                              </span>
                            )}
                          </td>
                          {/* Assigned */}
                          <td className="px-4 py-3 whitespace-nowrap">{renderAssigned(project)}</td>
                          {/* Payout */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm font-medium text-gray-900">{formatCurrency(project.payout_amount)}</div>
                            {project.estimated_labor_hours != null && (
                              <div className="text-[11px] text-gray-400">est {Number(project.estimated_labor_hours).toFixed(1)} h</div>
                            )}
                          </td>
                          {/* Docs */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2.5 text-gray-400">
                              {project.work_order_link ? (
                                <Tooltip text="Work order">
                                  <a href={project.work_order_link} target="_blank" rel="noopener noreferrer" className="hover:text-ember">
                                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                                    </svg>
                                  </a>
                                </Tooltip>
                              ) : (
                                <span className="text-gray-200"><DocDash /></span>
                              )}
                              {project.notes ? (
                                <Tooltip text="Has notes">
                                  <Link href={`/admin/projects/${project.id}`} className="hover:text-ember">
                                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                    </svg>
                                  </Link>
                                </Tooltip>
                              ) : (
                                <span className="text-gray-200"><DocDash /></span>
                              )}
                              <Tooltip text={photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : 'View photos'}>
                                <Link href={`/admin/photos/galleries/${project.id}`} className="inline-flex items-center gap-0.5 hover:text-ember">
                                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                                  </svg>
                                  {photoCount > 0 && <span className="text-[11px] font-medium">{photoCount}</span>}
                                </Link>
                              </Tooltip>
                            </div>
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {renderPrimaryAction(project)}
                              <RowMenu items={menuItems(project)} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Invite modal */}
      {inviteProjectId && (
        <InviteSubsModal
          projectId={inviteProjectId}
          tenantId={tenantId}
          tenantPlan={tenantPlan}
          existingInvitationSubIds={[]}
          onClose={() => {
            setInviteProjectId(null)
            router.refresh()
          }}
        />
      )}

      {/* Chat drawer */}
      <ChatDrawer
        isOpen={!!chatProject}
        onClose={() => setChatProject(null)}
        projectId={chatProject?.id ?? ''}
        projectTitle={chatProject ? `${chatProject.customer_name}${chatProject.job_number ? ` #${chatProject.job_number}` : ''}` : ''}
        currentUserId={currentUserId}
        onSend={sendMessage}
        onFetchMessages={getMessages}
        tenantPlan={tenantPlan}
        onRead={() => {
          if (chatProject) {
            setUnreadCounts((prev) => { const next = { ...prev }; delete next[chatProject.id]; return next })
          }
        }}
      />

      {/* Guided tour for first-time users */}
      <GuidedTour steps={projectsTourSteps} tourKey="admin-projects" />
    </AppShell>
  )
}

function StageCard({ label, value, count, active, onClick, dot, accent }: {
  label: string; value: number; count: number; active: boolean; onClick: () => void; dot: string; accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-ember ${
        active ? 'border-ember ring-1 ring-ember' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-ember' : 'text-gray-900'}`}>{formatCurrency(value)}</p>
      <p className="text-xs text-gray-400">{count} project{count === 1 ? '' : 's'}</p>
    </button>
  )
}

function DocDash() {
  return <span className="text-sm">–</span>
}

function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  if (items.length === 0) return null

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 176 }) // 176 = w-44
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="More actions"
        className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
        </svg>
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: pos.top, left: Math.max(8, pos.left) }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); it.onClick() }}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                  it.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function SortTh({ label, sortKey: key, currentKey, dir, onSort, align }: {
  label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align: 'left' | 'right'
}) {
  const active = key === currentKey
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white cursor-pointer select-none hover:bg-forest-700 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(key)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
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
