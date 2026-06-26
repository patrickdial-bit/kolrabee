import { getCurrentSub } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { backfillProjectGeocodes } from '@/lib/geocode'
import { extractCity, formatCurrency } from '@/lib/utils'
import { isCrewLeader } from '@/lib/types'
import type { Project } from '@/lib/types'
import type { MapPoint } from '@/components/JobsMap'
import SubMapClient from './SubMapClient'

type ProjRow = Pick<
  Project,
  'id' | 'customer_name' | 'job_number' | 'address' | 'status' | 'payout_amount' | 'latitude' | 'longitude' | 'geocoded_at'
>

const PROJ_COLS =
  'id, customer_name, job_number, address, status, payout_amount, latitude, longitude, geocoded_at'

// Round coordinates to ~1km so an un-accepted job's exact address is never
// shipped to the subcontractor's browser — matching the "city only before
// accepting" rule used elsewhere in the app.
function approxCoord(value: number): number {
  return Math.round(value * 100) / 100
}

export default async function SubMapPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  // Available = jobs this sub is invited to (and still available).
  const { data: invitations } = await adminClient
    .from('project_invitations')
    .select('project_id')
    .eq('subcontractor_id', appUser.id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'invited')
  const invitedIds = (invitations ?? []).map((i) => i.project_id)

  let availableProjects: ProjRow[] = []
  if (invitedIds.length > 0) {
    const { data } = await adminClient
      .from('projects')
      .select(PROJ_COLS)
      .in('id', invitedIds)
      .eq('status', 'available')
    availableProjects = (data ?? []) as ProjRow[]
  }

  // Accepted / in-progress / paid jobs this sub owns — exact location allowed.
  const { data: ownedData } = await adminClient
    .from('projects')
    .select(PROJ_COLS)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .in('status', ['accepted', 'in_progress', 'pending_completion', 'completed', 'paid'])
  const ownedProjects = (ownedData ?? []) as ProjRow[]

  // Lazily geocode any of the sub's visible jobs that were never geocoded.
  const all = [...availableProjects, ...ownedProjects]
  const needsGeocode = all.filter((p) => !p.geocoded_at && p.address?.trim())
  if (needsGeocode.length > 0) {
    await backfillProjectGeocodes(needsGeocode)
    // Re-fetch coordinates for just the projects we touched.
    const ids = needsGeocode.map((p) => p.id)
    const { data: refreshed } = await adminClient
      .from('projects')
      .select('id, latitude, longitude, geocoded_at')
      .in('id', ids)
    const byId = new Map((refreshed ?? []).map((r: any) => [r.id, r]))
    for (const p of all) {
      const r = byId.get(p.id)
      if (r) {
        p.latitude = r.latitude
        p.longitude = r.longitude
        p.geocoded_at = r.geocoded_at
      }
    }
  }

  const points: MapPoint[] = []

  for (const p of availableProjects) {
    if (p.latitude == null || p.longitude == null) continue
    points.push({
      id: p.id,
      lat: approxCoord(p.latitude),
      lng: approxCoord(p.longitude),
      title: p.customer_name,
      subtitle: extractCity(p.address),
      status: 'available',
      detail: formatCurrency(p.payout_amount ?? 0),
      href: `/${slug}/projects/${p.id}`,
      approximate: true,
    })
  }

  for (const p of ownedProjects) {
    if (p.latitude == null || p.longitude == null) continue
    points.push({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      title: p.customer_name,
      subtitle: [p.job_number ? `Job ${p.job_number}` : null, p.address].filter(Boolean).join(' · '),
      status: p.status,
      detail: formatCurrency(p.payout_amount ?? 0),
      href: `/${slug}/projects/${p.id}`,
    })
  }

  const unplaced = all.filter((p) => p.latitude == null || p.longitude == null).length

  return (
    <SubMapClient
      slug={slug}
      tenantName={tenant.name}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      isCrewLeader={isCrewLeader(appUser)}
      points={points}
      unplaced={unplaced}
    />
  )
}
