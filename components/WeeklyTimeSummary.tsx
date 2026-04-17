'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { formatMinutes, formatWeekLabel, sumDurationMinutes, weekRange } from '@/lib/time-tracking'

type Entry = {
  id: string
  project_id: string
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  projects?: { customer_name: string; job_number: string | null } | null
}

interface Props {
  subId: string
  fallbackTimezone: string
}

function detectTimezone(fallback: string): string {
  if (typeof Intl === 'undefined') return fallback
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback
  } catch {
    return fallback
  }
}

export default function WeeklyTimeSummary({ subId, fallbackTimezone }: Props) {
  const [timezone, setTimezone] = useState<string>(fallbackTimezone)
  const [weekOffset, setWeekOffset] = useState(0)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    setTimezone(detectTimezone(fallbackTimezone))
  }, [fallbackTimezone])

  const { startUtc, endUtc, label } = useMemo(() => {
    const { startUtc, endUtc } = weekRange(new Date(), timezone, weekOffset)
    return { startUtc, endUtc, label: formatWeekLabel(startUtc, timezone) }
  }, [timezone, weekOffset])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data } = await supabase
        .from('time_entries')
        .select('id, project_id, clock_in, clock_out, duration_minutes, projects:project_id (customer_name, job_number)')
        .eq('subcontractor_id', subId)
        .gte('clock_in', startUtc)
        .lt('clock_in', endUtc)
        .order('clock_in', { ascending: true })

      if (!cancelled) {
        // Supabase returns the joined relation as an array; normalize to single.
        const normalized: Entry[] = (data ?? []).map((row: any) => ({
          id: row.id,
          project_id: row.project_id,
          clock_in: row.clock_in,
          clock_out: row.clock_out,
          duration_minutes: row.duration_minutes,
          projects: Array.isArray(row.projects) ? row.projects[0] ?? null : row.projects ?? null,
        }))
        setEntries(normalized)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [subId, startUtc, endUtc])

  // Tick every minute so open entries update the running total.
  useEffect(() => {
    if (!entries.some((e) => e.clock_out === null)) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [entries])

  const byProject = useMemo(() => {
    const map = new Map<string, { label: string; minutes: number }>()
    for (const e of entries) {
      const mins =
        e.duration_minutes ??
        (e.clock_out === null ? Math.max(0, Math.floor((now.getTime() - new Date(e.clock_in).getTime()) / 60000)) : 0)
      const existing = map.get(e.project_id)
      const projectLabel = e.projects?.job_number || e.projects?.customer_name || 'Job'
      if (existing) {
        existing.minutes += mins
      } else {
        map.set(e.project_id, { label: projectLabel, minutes: mins })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes)
  }, [entries, now])

  const totalMinutes = useMemo(() => sumDurationMinutes(entries, now), [entries, now])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">This week</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatMinutes(totalMinutes)}</p>
          <p className="mt-0.5 text-xs text-gray-500">{label}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((n) => n - 1)}
            className="rounded-md bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
            aria-label="Previous week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeekOffset((n) => n + 1)}
            className="rounded-md bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
            aria-label="Next week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : byProject.length === 0 ? (
        <p className="text-sm text-gray-400">No time logged this week.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {byProject.map((p) => (
            <li key={p.label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-700">{p.label}</span>
              <span className="font-medium text-gray-900">{formatMinutes(p.minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
