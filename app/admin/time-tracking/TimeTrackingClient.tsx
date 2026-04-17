'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { formatMinutes, sumDurationMinutes, weekRange } from '@/lib/time-tracking'
import { deleteTimeEntry, updateTimeEntry } from './actions'

type Entry = {
  id: string
  subcontractor_id: string
  project_id: string
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  notes: string | null
  edited_by_admin_id: string | null
  edited_at: string | null
}
type Sub = { id: string; first_name: string; last_name: string }
type ProjectRow = { id: string; customer_name: string; job_number: string | null }

interface Props {
  tenantTimezone: string
  entries: Entry[]
  subs: Sub[]
  projects: ProjectRow[]
}

function detectTimezone(fallback: string): string {
  if (typeof Intl === 'undefined') return fallback
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback
  } catch {
    return fallback
  }
}

function formatZoned(iso: string | null, tz: string, fmt = 'MMM d, h:mm a'): string {
  if (!iso) return '—'
  return format(toZonedTime(new Date(iso), tz), fmt)
}

// yyyy-MM-ddTHH:mm in the given timezone, suitable for <input type="datetime-local">
function toDatetimeLocalZoned(iso: string, tz: string): string {
  return format(toZonedTime(new Date(iso), tz), "yyyy-MM-dd'T'HH:mm")
}

// Convert a "yyyy-MM-ddTHH:mm" (assumed in `tz`) to a UTC ISO string.
function datetimeLocalToIso(value: string, tz: string): string {
  // Build a Date interpreted as local-to-tz:
  // The trick: new Date("YYYY-MM-DDTHH:mm") treats input as local browser time.
  // We use the browser as the source of truth since the admin is on that tz.
  // If the admin viewer is in a different tz than `tz`, we still round-trip via ISO.
  return new Date(value).toISOString()
}

export default function TimeTrackingClient({ tenantTimezone, entries, subs, projects }: Props) {
  const [timezone, setTimezone] = useState<string>(tenantTimezone)
  const [weekOffset, setWeekOffset] = useState(0)
  const [subFilter, setSubFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ clock_in: string; clock_out: string; notes: string }>({ clock_in: '', clock_out: '', notes: '' })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    setTimezone(detectTimezone(tenantTimezone))
  }, [tenantTimezone])

  const { startUtc, endUtc, weekLabel } = useMemo(() => {
    const { startUtc, endUtc } = weekRange(new Date(), timezone, weekOffset)
    const startZoned = toZonedTime(new Date(startUtc), timezone)
    return {
      startUtc,
      endUtc,
      weekLabel: `Week of ${format(startZoned, 'MMM d, yyyy')}`,
    }
  }, [timezone, weekOffset])

  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, `${s.first_name} ${s.last_name}`])), [subs])
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p.job_number ? `#${p.job_number} – ${p.customer_name}` : p.customer_name])),
    [projects]
  )

  const inWeek = useMemo(() => {
    const startMs = new Date(startUtc).getTime()
    const endMs = new Date(endUtc).getTime()
    return entries.filter((e) => {
      const t = new Date(e.clock_in).getTime()
      if (t < startMs || t >= endMs) return false
      if (subFilter !== 'all' && e.subcontractor_id !== subFilter) return false
      if (projectFilter !== 'all' && e.project_id !== projectFilter) return false
      return true
    })
  }, [entries, startUtc, endUtc, subFilter, projectFilter])

  // Group by sub + project.
  const groups = useMemo(() => {
    const map = new Map<string, { subId: string; projectId: string; entries: Entry[]; totalMinutes: number }>()
    for (const e of inWeek) {
      const key = `${e.subcontractor_id}::${e.project_id}`
      const existing = map.get(key)
      if (existing) {
        existing.entries.push(e)
      } else {
        map.set(key, { subId: e.subcontractor_id, projectId: e.project_id, entries: [e], totalMinutes: 0 })
      }
    }
    const groups = Array.from(map.values())
    for (const g of groups) {
      g.totalMinutes = sumDurationMinutes(g.entries)
      g.entries.sort((a: Entry, b: Entry) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime())
    }
    return groups.sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [inWeek])

  function startEdit(e: Entry) {
    setEditingId(e.id)
    setEditForm({
      clock_in: toDatetimeLocalZoned(e.clock_in, timezone),
      clock_out: e.clock_out ? toDatetimeLocalZoned(e.clock_out, timezone) : '',
      notes: e.notes ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
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

  function exportCsv() {
    const rows = [
      ['Subcontractor', 'Job', 'Clock In', 'Clock Out', 'Duration (min)', 'Notes', 'Edited By Admin', 'Edited At'],
    ]
    for (const g of groups) {
      for (const e of g.entries) {
        rows.push([
          subMap.get(g.subId) ?? g.subId,
          projectMap.get(g.projectId) ?? g.projectId,
          formatZoned(e.clock_in, timezone, "yyyy-MM-dd HH:mm"),
          e.clock_out ? formatZoned(e.clock_out, timezone, "yyyy-MM-dd HH:mm") : '',
          e.duration_minutes !== null ? String(e.duration_minutes) : '',
          (e.notes ?? '').replace(/[\r\n]+/g, ' '),
          e.edited_by_admin_id ? 'yes' : '',
          e.edited_at ? formatZoned(e.edited_at, timezone, "yyyy-MM-dd HH:mm") : '',
        ])
      }
    }
    const csv = rows
      .map((r) => r.map((cell) => {
        const s = String(cell ?? '')
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-tracking-${weekLabel.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="mt-1 text-sm text-gray-500">{weekLabel} · {timezone}</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((n) => n - 1)}
            className="rounded-md bg-white border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Previous week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-md bg-white border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              This week
            </button>
          )}
          <button
            onClick={() => setWeekOffset((n) => n + 1)}
            className="rounded-md bg-white border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Next week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          </button>
          <button
            onClick={exportCsv}
            className="ml-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-forest-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={subFilter}
          onChange={(e) => setSubFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All subcontractors</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All jobs</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.job_number ? `#${p.job_number} – ${p.customer_name}` : p.customer_name}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{groups.length} group{groups.length === 1 ? '' : 's'}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Subcontractor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Job</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Week</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Entries</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No time logged for these filters.</td>
              </tr>
            ) : (
              groups.map((g) => {
                const key = `${g.subId}::${g.projectId}`
                const expanded = expandedGroup === key
                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{subMap.get(g.subId) ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{projectMap.get(g.projectId) ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{weekLabel}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">{formatMinutes(g.totalMinutes)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{g.entries.length}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedGroup(expanded ? null : key)}
                          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          {expanded ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-4 py-3">
                          <table className="min-w-full">
                            <thead>
                              <tr className="text-xs font-semibold uppercase text-gray-500">
                                <th className="text-left py-1">Clock in</th>
                                <th className="text-left py-1">Clock out</th>
                                <th className="text-right py-1">Duration</th>
                                <th className="text-left py-1 pl-3">Notes</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {g.entries.map((e) => (
                                <tr key={e.id} className="text-sm">
                                  {editingId === e.id ? (
                                    <>
                                      <td className="py-2">
                                        <input
                                          type="datetime-local"
                                          value={editForm.clock_in}
                                          onChange={(ev) => setEditForm({ ...editForm, clock_in: ev.target.value })}
                                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                                        />
                                      </td>
                                      <td className="py-2">
                                        <input
                                          type="datetime-local"
                                          value={editForm.clock_out}
                                          onChange={(ev) => setEditForm({ ...editForm, clock_out: ev.target.value })}
                                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                                        />
                                      </td>
                                      <td className="py-2 text-right text-gray-400 tabular-nums">—</td>
                                      <td className="py-2 pl-3">
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
                                          onClick={cancelEdit}
                                          className="ml-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                                        >
                                          Cancel
                                        </button>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-2 text-gray-700">{formatZoned(e.clock_in, timezone)}</td>
                                      <td className="py-2 text-gray-700">
                                        {e.clock_out ? formatZoned(e.clock_out, timezone) : <span className="text-amber-600">Open</span>}
                                      </td>
                                      <td className="py-2 text-right tabular-nums text-gray-900">{e.duration_minutes !== null ? formatMinutes(e.duration_minutes) : '—'}</td>
                                      <td className="py-2 pl-3 text-gray-600">
                                        {e.notes || '—'}
                                        {e.edited_by_admin_id && (
                                          <span className="ml-2 text-xs text-amber-600">(edited)</span>
                                        )}
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
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
