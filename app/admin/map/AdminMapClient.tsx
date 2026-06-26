'use client'

import AppShell from '@/components/AppShell'
import JobsMapPanel from '@/components/JobsMapPanel'
import type { MapPoint } from '@/components/JobsMap'

export default function AdminMapClient({
  companyName,
  points,
  unplaced,
}: {
  companyName: string
  points: MapPoint[]
  unplaced: number
}) {
  return (
    <AppShell variant="admin" companyName={companyName}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Job Map</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every active job plotted by address. Click a pin for details.
          </p>
        </div>
        <JobsMapPanel
          points={points}
          unplaced={unplaced}
          emptyMessage="No jobs to map yet. Create a project with an address to see it here."
        />
      </div>
    </AppShell>
  )
}
