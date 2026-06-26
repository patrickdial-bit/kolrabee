'use client'

// JobsMapPanel — chrome around <JobsMap>: client-only dynamic import, a status
// legend, an empty state, and a count of jobs that couldn't be placed on the
// map (missing/failed geocoding). Used by both the admin and subcontractor map
// pages so the two surfaces stay visually consistent.

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
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
  // Only show legend entries for statuses actually present on the map.
  const activeStatuses = useMemo(() => {
    const set = new Set(points.map((p) => p.status))
    return LEGEND.filter((l) => set.has(l.status))
  }, [points])

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        {points.length === 0 ? (
          <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
            <p className="text-sm text-gray-500">{emptyMessage}</p>
          </div>
        ) : (
          <JobsMap points={points} className="h-[60vh] w-full" />
        )}
      </div>

      {(activeStatuses.length > 0 || unplaced > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-gray-600">
          {activeStatuses.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
          {unplaced > 0 && (
            <span className="text-gray-400">
              {unplaced} job{unplaced === 1 ? '' : 's'} not yet placed on the map
            </span>
          )}
        </div>
      )}
    </div>
  )
}
