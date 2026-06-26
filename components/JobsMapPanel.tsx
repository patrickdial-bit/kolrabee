'use client'

// JobsMapPanel — chrome around <JobsMap>: client-only dynamic import, an
// interactive stage filter (toggle pins on/off by job status), an empty state,
// and a count of jobs that couldn't be placed on the map (missing/failed
// geocoding). Used by both the admin and subcontractor map pages so the two
// surfaces stay visually consistent.

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
  // Track hidden stages (empty = all shown). Storing the hidden set means stages
  // that appear later default to visible.
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  // Legend entries + counts for the statuses actually present on the map.
  const stages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of points) {
      const key = p.status ?? ''
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return LEGEND.filter((l) => counts.has(l.status)).map((l) => ({ ...l, count: counts.get(l.status) ?? 0 }))
  }, [points])

  const visiblePoints = useMemo(
    () => points.filter((p) => !hidden.has(p.status ?? '')),
    [points, hidden],
  )

  function toggle(status: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const allShown = hidden.size === 0
  const noneVisible = points.length > 0 && visiblePoints.length === 0

  return (
    <div className="space-y-3">
      {/* Stage filter */}
      {stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Stages:</span>
          {stages.map((s) => {
            const off = hidden.has(s.status)
            return (
              <button
                key={s.status}
                type="button"
                onClick={() => toggle(s.status)}
                aria-pressed={!off}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  off
                    ? 'border-gray-200 bg-white text-gray-400'
                    : 'border-gray-300 bg-gray-50 text-gray-700'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: off ? '#d1d5db' : s.color }}
                />
                <span className={off ? 'line-through' : ''}>{s.label}</span>
                <span className={off ? 'text-gray-300' : 'text-gray-400'}>({s.count})</span>
              </button>
            )
          })}
          {!allShown && (
            <button
              type="button"
              onClick={() => setHidden(new Set())}
              className="text-xs font-medium text-ember hover:underline"
            >
              Show all
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        {points.length === 0 ? (
          <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
            <p className="text-sm text-gray-500">{emptyMessage}</p>
          </div>
        ) : noneVisible ? (
          <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
            <p className="text-sm text-gray-500">No jobs match the selected stages.</p>
            <button type="button" onClick={() => setHidden(new Set())} className="text-sm font-medium text-ember hover:underline">
              Show all stages
            </button>
          </div>
        ) : (
          <JobsMap points={visiblePoints} className="h-[60vh] w-full" />
        )}
      </div>

      {unplaced > 0 && (
        <p className="px-1 text-xs text-gray-400">
          {unplaced} job{unplaced === 1 ? '' : 's'} not yet placed on the map
        </p>
      )}
    </div>
  )
}
