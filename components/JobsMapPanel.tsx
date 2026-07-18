'use client'

// JobsMapPanel — chrome around <JobsMap>: client-only dynamic import, a
// clickable stage filter (one chip per status present, with counts), an empty
// state, and a count of jobs that couldn't be placed on the map. Used by both
// the admin and subcontractor map pages so the two surfaces stay consistent.

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import type { MapPoint } from '@/components/JobsMap'

const JobsMap = dynamic(() => import('@/components/JobsMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
      Loading map…
    </div>
  ),
})

const LEGEND: Array<{ label: string; status: string; color: string }> = [
  { label: 'Available', status: 'available', color: '#f59e0b' },
  { label: 'Accepted', status: 'accepted', color: '#3b82f6' },
  { label: 'In progress', status: 'in_progress', color: '#6366f1' },
  { label: 'Pending', status: 'pending_completion', color: '#f97316' },
  { label: 'Completed', status: 'completed', color: '#22c55e' },
  { label: 'Paid', status: 'paid', color: '#059669' },
]

export default function JobsMapPanel({
  points,
  unplaced = 0,
  emptyMessage = 'No job locations to show yet.',
}: {
  points: MapPoint[]
  /** Jobs that exist but have no coordinates (geocoding pending or failed). */
  unplaced?: number
  emptyMessage?: string
}) {
  // Statuses hidden by the filter chips. Points with no status are always shown.
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of points) {
      if (!p.status) continue
      counts.set(p.status, (counts.get(p.status) ?? 0) + 1)
    }
    return counts
  }, [points])

  // Only show chips for statuses actually present on the map.
  const chips = useMemo(() => LEGEND.filter((l) => statusCounts.has(l.status)), [statusCounts])

  const visiblePoints = useMemo(
    () => points.filter((p) => !p.status || !hidden.has(p.status)),
    [points, hidden]
  )

  function toggle(status: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const allFilteredOut = points.length > 0 && visiblePoints.length === 0

  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {chips.map((l) => {
            const isHidden = hidden.has(l.status)
            return (
              <button
                key={l.status}
                type="button"
                onClick={() => toggle(l.status)}
                aria-pressed={!isHidden}
                title={isHidden ? `Show ${l.label.toLowerCase()} jobs` : `Hide ${l.label.toLowerCase()} jobs`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isHidden
                    ? 'border-gray-200 bg-gray-100 text-gray-400'
                    : 'border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: isHidden ? '#d1d5db' : l.color }}
                />
                {l.label}
                <span className={isHidden ? 'text-gray-400' : 'font-semibold text-gray-900'}>
                  {statusCounts.get(l.status)}
                </span>
              </button>
            )
          })}
          {hidden.size > 0 && (
            <button
              type="button"
              onClick={() => setHidden(new Set())}
              className="text-xs font-semibold text-ember hover:text-primary-700"
            >
              Show all
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        {points.length === 0 || allFilteredOut ? (
          <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
            <p className="text-sm text-gray-500">
              {allFilteredOut ? 'No jobs match the selected stages.' : emptyMessage}
            </p>
            {allFilteredOut && (
              <button
                type="button"
                onClick={() => setHidden(new Set())}
                className="text-sm font-semibold text-ember hover:text-primary-700"
              >
                Show all stages
              </button>
            )}
          </div>
        ) : (
          <JobsMap points={visiblePoints} className="h-[60vh] w-full" />
        )}
      </div>

      {unplaced > 0 && (
        <div className="px-1 text-xs text-gray-400">
          {unplaced} job{unplaced === 1 ? '' : 's'} not yet placed on the map
        </div>
      )}
    </div>
  )
}
