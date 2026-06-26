'use client'

import AppShell from '@/components/AppShell'
import JobsMapPanel from '@/components/JobsMapPanel'
import type { MapPoint } from '@/components/JobsMap'

export default function SubMapClient({
  slug,
  tenantName,
  subName,
  isCrewLeader,
  points,
  unplaced,
}: {
  slug: string
  tenantName: string
  subName: string
  isCrewLeader: boolean
  points: MapPoint[]
  unplaced: number
}) {
  return (
    <AppShell variant="sub" slug={slug} tenantName={tenantName} subName={subName} isCrewLeader={isCrewLeader}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Job Map</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your accepted jobs show their exact location. Available jobs show an approximate area
            until you accept them.
          </p>
        </div>
        <JobsMapPanel
          points={points}
          unplaced={unplaced}
          emptyMessage="No jobs to map yet. Accept a job or check your invitations to see locations here."
        />
      </div>
    </AppShell>
  )
}
