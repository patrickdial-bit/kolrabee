'use client'

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import {
  RANGE_PRESETS,
  formatMinutes,
  sumDurationMinutes,
  type RangePreset,
  type ResolvedRange,
} from '@/lib/time-tracking'
import { deleteTimeEntry, updateTimeEntry } from './actions'

type Entry = {
  id: string
  subcontractor_id: string
  crew_member_id: string | null
  project_id: string
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  notes: string | null
  edited_by_admin_id: string | null
  edited_at: string | null
}
type Sub = { id: string; first_name: string; last_name: string; status: string | null }
type ProjectRow = {
  id: string
  customer_name: string
  job_number: string | null
  address: string | null
  status: string | null
}
type CrewMember = { id: string; first_name: string; last_name: string; crew_leader_id: string }

type GroupBy = 'job' | 'worker' | 'job_worker' | 'none'
type SortKey = 'hours' | 'recent' | 'name'

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'job', label: 'Group by job' },
  { value: 'worker', label: 'Group by worker' },
  { value: 'job_worker', label: 'Group by job + worker' },
  { value: 'none', label: 'No grouping (all entries)' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'hours', label: 'Most hours' },
  { value: 'recent', label: 'Most recent' },
  { value: 'name', label: 'Name (A–Z)' },
]

interface Props {
  timezone: string
  range: ResolvedRange
  truncated: boolean
  maxEntries: number
  entries: Entry[]
  subs: Sub[]
  projects: ProjectRow[]
  crew: CrewMember[]
  initialSubFilter: string
  initialProjectFilter: string
  initialSearch: string
  initialGroupBy: string
}

function formatZoned(iso: string | null, tz: string, fmt = 'MMM d, h:mm a'): string {
  if (!iso) return '—'
  return format(toZonedTime(new Date(iso), tz), fmt)
}

// yyyy-MM-ddTHH:mm in the given timezone, suitable for <input type="datetime-local">
function toDatetimeLocalZoned(iso: string, tz: string): string {
  return format(toZonedTime(new Date(iso), tz), "yyyy-MM-dd'T'HH:mm")
}

// Convert a "yyyy-MM-ddTHH:mm" wall-clock value in `tz` back to a UTC ISO string.
function datetimeLocalToIso(value: string, tz: string): string {
  return fromZonedTime(value, tz).toISOString()
}

function projectLabel(p: ProjectRow): string {
  return p.job_number ? `#${p.job_number} – ${p.customer_name}` : p.customer_name
}

function subOptionLabel(s: Sub): string {
  const name = `${s.first_name} ${s.last_name}`.trim()
  return s.status && s.status !== 'active' ? `${name} (${s.status})` : name
}

function isGroupBy(value: string): value is GroupBy {
  return GROUP_OPTIONS.some((o) => o.value === value)
}

type Group = {
  key: string
  title: string
  href: string | null
  subtitle: string
  coverage: string
  entries: Entry[]
  totalMinutes: number
  openCount: number
  firstMs: number
  lastMs: number
}

export default function TimeTrackingClient({
  timezone,
  range,
  truncated,
  maxEntries,
  entries,
  subs,
  projects,
  crew,
  initialSubFilter,
  initialProjectFilter,
  initialSearch,
  initialGroupBy,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [subFilter, setSubFilter] = useState(initialSubFilter)
  const [projectFilter, setProjectFilter] = useState(initialProjectFilter)
  const [groupBy, setGroupBy] = useState<GroupBy>(isGroupBy(initialGroupBy) ? initialGroupBy : 'job')
  const [sortKey, setSortKey] = useState<SortKey>('hours')

  const [customFrom, setCustomFrom] = useState(range.fromDay ?? '')
  const [customTo, setCustomTo] = useState(range.toDay ?? '')

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', notes: '' })

  useEffect(() => {
    setCustomFrom(range.fromDay ?? '')
    setCustomTo(range.toDay ?? '')
  }, [range.fromDay, range.toDay])

  // Lookups -----------------------------------------------------------------
  const subMap = useMemo(
    () => new Map(subs.map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()])),
    [subs]
  )
  const crewMap = useMemo(
    () => new Map(crew.map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()])),
    [crew]
  )
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Only offer jobs and subs that actually appear somewhere in this range,
  // plus whatever is currently selected, so the dropdowns stay usable.
  const { projectsWithTime, otherProjects } = useMemo(() => {
    const ids = new Set(entries.map((e) => e.project_id))
    return {
      projectsWithTime: projects.filter((p) => ids.has(p.id)),
      otherProjects: projects.filter((p) => !ids.has(p.id)),
    }
  }, [entries, projects])

  const { subsWithTime, otherSubs } = useMemo(() => {
    const ids = new Set(entries.map((e) => e.subcontractor_id))
    return {
      subsWithTime: subs.filter((s) => ids.has(s.id)),
      otherSubs: subs.filter((s) => !ids.has(s.id)),
    }
  }, [entries, subs])

  const workerName = useCallback(
    (e: Entry) => (e.crew_member_id ? crewMap.get(e.crew_member_id) ?? 'Crew member' : subMap.get(e.subcontractor_id) ?? 'Unknown'),
    [crewMap, subMap]
  )
  const leaderName = useCallback((e: Entry) => subMap.get(e.subcontractor_id) ?? 'Unknown', [subMap])

  // URL sync (no server round-trip — the range is the only server-side filter).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const set = (key: string, value: string, fallback: string) => {
      if (value === fallback) params.delete(key)
      else params.set(key, value)
    }
    set('q', search.trim(), '')
    set('sub', subFilter, 'all')
    set('project', projectFilter, 'all')
    set('group', groupBy, 'job')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [search, subFilter, projectFilter, groupBy])

  // Filtering ---------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (subFilter !== 'all' && e.subcontractor_id !== subFilter) return false
      if (projectFilter !== 'all' && e.project_id !== projectFilter) return false
      if (!q) return true
      const project = projectMap.get(e.project_id)
      const haystack = [
        workerName(e),
        leaderName(e),
        project?.customer_name,
        project?.job_number,
        project?.address,
        e.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, search, subFilter, projectFilter, projectMap, workerName, leaderName])

  // Summary -----------------------------------------------------------------
  const summary = useMemo(() => {
    const jobs = new Set<string>()
    const workers = new Set<string>()
    let open = 0
    for (const e of filtered) {
      jobs.add(e.project_id)
      workers.add(e.crew_member_id ?? e.subcontractor_id)
      if (!e.clock_out) open += 1
    }
    return {
      totalMinutes: sumDurationMinutes(filtered),
      entryCount: filtered.length,
      jobCount: jobs.size,
      workerCount: workers.size,
      openCount: open,
    }
  }, [filtered])

  // Grouping ----------------------------------------------------------------
  const groups: Group[] = useMemo(() => {
    if (groupBy === 'none') return []

    const buckets = new Map<string, Entry[]>()
    for (const e of filtered) {
      const actor = e.crew_member_id ?? e.subcontractor_id
      const key =
        groupBy === 'job' ? e.project_id : groupBy === 'worker' ? actor : `${e.project_id}::${actor}`
      const bucket = buckets.get(key)
      if (bucket) bucket.push(e)
      else buckets.set(key, [e])
    }

    const result: Group[] = []
    for (const [key, bucketEntries] of Array.from(buckets.entries())) {
      const sample = bucketEntries[0]
      const project = projectMap.get(sample.project_id)
      let firstMs = Number.POSITIVE_INFINITY
      let lastMs = Number.NEGATIVE_INFINITY
      for (const e of bucketEntries) {
        const t = new Date(e.clock_in).getTime()
        if (t < firstMs) firstMs = t
        if (t > lastMs) lastMs = t
      }

      let title: string
      let href: string | null = null
      let subtitle: string
      let coverage: string

      if (groupBy === 'job') {
        title = project ? projectLabel(project) : 'Deleted job'
        href = project ? `/admin/projects/${project.id}` : null
        subtitle = [project?.address, project?.status].filter(Boolean).join(' · ')
        const workers = new Set(bucketEntries.map((e) => e.crew_member_id ?? e.subcontractor_id))
        coverage = `${workers.size} worker${workers.size === 1 ? '' : 's'}`
      } else if (groupBy === 'worker') {
        title = workerName(sample)
        subtitle = sample.crew_member_id ? `Crew of ${leaderName(sample)}` : 'Subcontractor'
        const jobs = new Set(bucketEntries.map((e) => e.project_id))
        coverage = `${jobs.size} job${jobs.size === 1 ? '' : 's'}`
      } else {
        title = project ? projectLabel(project) : 'Deleted job'
        href = project ? `/admin/projects/${project.id}` : null
        subtitle = workerName(sample) + (sample.crew_member_id ? ` · crew of ${leaderName(sample)}` : '')
        coverage = ''
      }

      bucketEntries.sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime())

      result.push({
        key,
        title,
        href,
        subtitle,
        coverage,
        entries: bucketEntries,
        totalMinutes: sumDurationMinutes(bucketEntries),
        openCount: bucketEntries.filter((e) => !e.clock_out).length,
        firstMs,
        lastMs,
      })
    }

    result.sort((a, b) => {
      if (sortKey === 'recent') return b.lastMs - a.lastMs
      if (sortKey === 'name') return a.title.localeCompare(b.title)
      return b.totalMinutes - a.totalMinutes
    })
    return result
  }, [filtered, groupBy, sortKey, projectMap, workerName, leaderName])

  const flatEntries = useMemo(
    () =>
      groupBy === 'none'
        ? [...filtered].sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime())
        : [],
    [filtered, groupBy]
  )

  // Range navigation --------------------------------------------------------
  function applyRange(preset: RangePreset, from?: string, to?: string) {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    params.set('range', preset)
    if (preset === 'custom') {
      if (from) params.set('from', from)
      else params.delete('from')
      if (to) params.set('to', to)
      else params.delete('to')
    } else {
      params.delete('from')
      params.delete('to')
    }
    startTransition(() => {
      router.push(`/admin/time-tracking?${params.toString()}`)
    })
  }

  function onPresetChange(value: string) {
    const preset = value as RangePreset
    if (preset === 'custom') {
      applyRange('custom', customFrom || undefined, customTo || undefined)
      return
    }
    applyRange(preset)
  }

  function clearFilters() {
    setSearch('')
    setSubFilter('all')
    setProjectFilter('all')
  }

  const filtersActive = search.trim() !== '' || subFilter !== 'all' || projectFilter !== 'all'

  // Entry editing -----------------------------------------------------------
  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function startEdit(e: Entry) {
    setEditingId(e.id)
    setEditForm({
      clock_in: toDatetimeLocalZoned(e.clock_in, timezone),
      clock_out: e.clock_out ? toDatetimeLocalZoned(e.clock_out, timezone) : '',
      notes: e.notes ?? '',
    })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const updates: { clock_in?: string; clock_out?: string | null; notes?: string | null } = {}
      if (editForm.clock_in) updates.clock_in = datetimeLocalToIso(editForm.clock_in, timezone)
      updates.clock_out = editForm.clock_out ? datetimeLocalToIso(editForm.clock_out, timezone) : null
      updates.notes = editForm.notes.trim() ? editForm.notes.trim() : null
      const result = await updateTimeEntry(id, updates)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Entry updated.')
      setEditingId(null)
      router.refresh()
    })
  }

  function removeEntry(id: string) {
    if (!confirm('Delete this time entry? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteTimeEntry(id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Entry deleted.')
      router.refresh()
    })
  }

  // CSV ---------------------------------------------------------------------
  function exportCsv() {
    const rows: string[][] = [
      [
        'Date',
        'Worker',
        'Crew leader',
        'Job number',
        'Customer',
        'Address',
        'Clock in',
        'Clock out',
        'Duration (min)',
        'Hours',
        'Notes',
        'Edited by admin',
        'Edited at',
      ],
    ]
    const source = groupBy === 'none' ? flatEntries : groups.flatMap((g) => g.entries)
    for (const e of source) {
      const project = projectMap.get(e.project_id)
      rows.push([
        formatZoned(e.clock_in, timezone, 'yyyy-MM-dd'),
        workerName(e),
        leaderName(e),
        project?.job_number ?? '',
        project?.customer_name ?? '',
        project?.address ?? '',
        formatZoned(e.clock_in, timezone, 'yyyy-MM-dd HH:mm'),
        e.clock_out ? formatZoned(e.clock_out, timezone, 'yyyy-MM-dd HH:mm') : '',
        e.duration_minutes !== null ? String(e.duration_minutes) : '',
        e.duration_minutes !== null ? (e.duration_minutes / 60).toFixed(2) : '',
        (e.notes ?? '').replace(/[\r\n]+/g, ' '),
        e.edited_by_admin_id ? 'yes' : '',
        e.edited_at ? formatZoned(e.edited_at, timezone, 'yyyy-MM-dd HH:mm') : '',
      ])
    }
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '')
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-tracking-${(range.fromDay ?? 'all')}-to-${range.toDay ?? 'now'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Rendering ---------------------------------------------------------------
  function renderEntryRows(list: Entry[], opts: { showJob: boolean; showWorker: boolean }) {
    const columns = 5 + (opts.showJob ? 1 : 0) + (opts.showWorker ? 1 : 0)
    return (
      <table className="min-w-full">
        <thead>
          <tr className="text-xs font-semibold uppercase text-gray-500">
            {opts.showWorker && <th className="text-left py-1 pr-3">Worker</th>}
            {opts.showJob && <th className="text-left py-1 pr-3">Job</th>}
            <th className="text-left py-1 pr-3">Clock in</th>
            <th className="text-left py-1 pr-3">Clock out</th>
            <th className="text-right py-1 pr-3">Duration</th>
            <th className="text-left py-1 pr-3">Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={columns} className="py-4 text-center text-sm text-gray-500">
                No entries.
              </td>
            </tr>
          )}
          {list.map((e) => {
            const project = projectMap.get(e.project_id)
            const editing = editingId === e.id
            return (
              <tr key={e.id} className="text-sm align-top">
                {opts.showWorker && (
                  <td className="py-2 pr-3 text-gray-700">
                    {workerName(e)}
                    {e.crew_member_id && (
                      <span className="block text-xs text-gray-400">crew of {leaderName(e)}</span>
                    )}
                  </td>
                )}
                {opts.showJob && (
                  <td className="py-2 pr-3">
                    {project ? (
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="text-ember hover:text-primary-700 hover:underline"
                      >
                        {projectLabel(project)}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Deleted job</span>
                    )}
                  </td>
                )}
                {editing ? (
                  <>
                    <td className="py-2 pr-3">
                      <input
                        type="datetime-local"
                        value={editForm.clock_in}
                        onChange={(ev) => setEditForm({ ...editForm, clock_in: ev.target.value })}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="datetime-local"
                        value={editForm.clock_out}
                        onChange={(ev) => setEditForm({ ...editForm, clock_out: ev.target.value })}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-400 tabular-nums">—</td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(ev) => setEditForm({ ...editForm, notes: ev.target.value })}
                        placeholder="Notes"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => saveEdit(e.id)}
                        disabled={isPending}
                        className="rounded-md bg-ember px-2 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        {isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="ml-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                      {formatZoned(e.clock_in, timezone)}
                    </td>
                    <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                      {e.clock_out ? formatZoned(e.clock_out, timezone) : <span className="text-amber-600">Open</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-gray-900 whitespace-nowrap">
                      {e.duration_minutes !== null ? formatMinutes(e.duration_minutes) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      {e.notes || '—'}
                      {e.edited_by_admin_id && <span className="ml-2 text-xs text-amber-600">(edited)</span>}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(e)}
                        className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeEntry(e.id)}
                        className="ml-1 rounded-md bg-white border border-gray-300 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const spanLabel = (g: Group) => {
    const first = formatZoned(new Date(g.firstMs).toISOString(), timezone, 'MMM d, yyyy')
    const last = formatZoned(new Date(g.lastMs).toISOString(), timezone, 'MMM d, yyyy')
    return first === last ? first : `${first} – ${last}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="mt-1 text-sm text-gray-500">
            {range.label} · times shown in {timezone}
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={exportCsv}
            className="rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-forest-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Time frame ------------------------------------------------------- */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Time frame</label>
            <select
              value={range.preset}
              onChange={(e) => onPresetChange(e.target.value)}
              disabled={isPending}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => applyRange('custom', customFrom || undefined, customTo || undefined)}
            disabled={isPending || (!customFrom && !customTo)}
            className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Apply dates
          </button>
          <button
            onClick={() => applyRange('all')}
            disabled={isPending}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            All history
          </button>
        </div>
      </div>

      {/* Search + filters -------------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-4.65a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job number, customer, address, worker, or notes…"
            className="w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={subFilter}
          onChange={(e) => setSubFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All subcontractors</option>
          {subsWithTime.length > 0 && (
            <optgroup label="Subs with time in range">
              {subsWithTime.map((s) => (
                <option key={s.id} value={s.id}>
                  {subOptionLabel(s)}
                </option>
              ))}
            </optgroup>
          )}
          {otherSubs.length > 0 && (
            <optgroup label="Other subcontractors">
              {otherSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {subOptionLabel(s)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All jobs</option>
          {projectsWithTime.length > 0 && (
            <optgroup label="Jobs with time in range">
              {projectsWithTime.map((p) => (
                <option key={p.id} value={p.id}>
                  {projectLabel(p)}
                </option>
              ))}
            </optgroup>
          )}
          {otherProjects.length > 0 && (
            <optgroup label="Other jobs">
              {otherProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {projectLabel(p)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {groupBy !== 'none' && (
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {filtersActive && (
          <button
            onClick={clearFilters}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {truncated && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing the {maxEntries.toLocaleString()} most recent entries in this range. Narrow the time frame for a
          complete total.
        </div>
      )}

      {/* Summary ----------------------------------------------------------- */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total hours', value: formatMinutes(summary.totalMinutes) },
          { label: 'Entries', value: summary.entryCount.toLocaleString() },
          { label: 'Jobs', value: summary.jobCount.toLocaleString() },
          { label: 'Workers', value: summary.workerCount.toLocaleString() },
          { label: 'Still clocked in', value: summary.openCount.toLocaleString() },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-semibold uppercase text-gray-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-gray-900 tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Results ----------------------------------------------------------- */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {groupBy === 'none' ? (
          <div className="p-4">{renderEntryRows(flatEntries, { showJob: true, showWorker: true })}</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  {groupBy === 'worker' ? 'Worker' : 'Job'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  {groupBy === 'job_worker' ? 'Worker' : 'Detail'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Activity</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Entries</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No time logged for this time frame and these filters.
                  </td>
                </tr>
              ) : (
                groups.map((g) => {
                  const expanded = expandedGroups.has(g.key)
                  return (
                    <React.Fragment key={g.key}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {g.href ? (
                            <Link
                              href={g.href}
                              className="font-medium text-ember hover:text-primary-700 hover:underline"
                            >
                              {g.title}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-900">{g.title}</span>
                          )}
                          {g.coverage && <div className="text-xs text-gray-500">{g.coverage}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.subtitle || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{spanLabel(g)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-center">
                          {g.entries.length}
                          {g.openCount > 0 && (
                            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                              {g.openCount} open
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">
                          {formatMinutes(g.totalMinutes)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => toggleGroup(g.key)}
                            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            {expanded ? 'Hide' : 'Show'}
                          </button>
                          {g.href && (
                            <Link
                              href={g.href}
                              className="ml-1 inline-block rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Job details
                            </Link>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50 px-4 py-3">
                            {renderEntryRows(g.entries, {
                              showJob: groupBy === 'worker',
                              showWorker: groupBy === 'job',
                            })}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {groupBy !== 'none' && groups.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {groups.length} {groupBy === 'worker' ? 'worker' : 'group'}
          {groups.length === 1 ? '' : 's'} · {summary.entryCount} entr{summary.entryCount === 1 ? 'y' : 'ies'}
        </p>
      )}
    </div>
  )
}
