import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { backfillProjectGeocodes, getAreaCenter, jitterPoint } from '@/lib/geocode'
import { formatCurrency } from '@/lib/utils'
import type { Project } from '@/lib/types'
import type { MapPoint } from '@/components/JobsMap'
import AdminMapClient from './AdminMapClient'

// Admin job map: plots every active job at its exact location. Admins see full
// addresses, so no privacy masking is applied here.
export default async function AdminMapPage() {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: projectsRaw } = await adminClient
    .from('projects')
    .select('id, customer_name, job_number, address, status, payout_amount, latitude, longitude, geocoded_at')
    .eq('tenant_id', tenant.id)
    .neq('status', 'cancelled')
    .neq('status', 'imported')

  let projects = (projectsRaw ?? []) as Array<
    Pick<Project, 'id' | 'customer_name' | 'job_number' | 'address' | 'status' | 'payout_amount' | 'latitude' | 'longitude' | 'geocoded_at'>
  >

  // Lazily geocode any jobs that have never been geocoded so existing data
  // appears on the map without a manual backfill. Best-effort and capped.
  const needsGeocode = projects.filter((p) => !p.geocoded_at && p.address?.trim())
  if (needsGeocode.length > 0) {
    await backfillProjectGeocodes(needsGeocode, tenant.service_area)
    const { data: refreshed } = await adminClient
      .from('projects')
      .select('id, customer_name, job_number, address, status, payout_amount, latitude, longitude, geocoded_at')
      .eq('tenant_id', tenant.id)
      .neq('status', 'cancelled')
      .neq('status', 'imported')
    if (refreshed) projects = refreshed as typeof projects
  }

  const points: MapPoint[] = projects
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      id: p.id,
      lat: p.latitude as number,
      lng: p.longitude as number,
      title: p.customer_name,
      subtitle: [p.job_number ? `Job ${p.job_number}` : null, p.address].filter(Boolean).join(' · '),
      status: p.status,
      detail: formatCurrency(p.payout_amount ?? 0),
      href: `/admin/projects/${p.id}`,
    }))

  // Jobs whose addresses couldn't be pinpointed still show on the map — as
  // soft approximate circles spread around the tenant's service area.
  const unplacedProjects = projects.filter((p) => p.latitude == null || p.longitude == null)
  const areaCenter = unplacedProjects.length > 0 ? await getAreaCenter(tenant.service_area) : null
  if (areaCenter) {
    for (const p of unplacedProjects) {
      const spot = jitterPoint(areaCenter, p.id)
      points.push({
        id: p.id,
        lat: spot.lat,
        lng: spot.lng,
        title: p.customer_name,
        subtitle: [p.job_number ? `Job ${p.job_number}` : null, p.address].filter(Boolean).join(' · '),
        status: p.status,
        detail: formatCurrency(p.payout_amount ?? 0),
        href: `/admin/projects/${p.id}`,
        approximate: true,
        approximateNote: "Approximate — this address couldn't be pinpointed, so it's shown in your service area.",
      })
    }
  }
  const unplaced = areaCenter ? 0 : unplacedProjects.length

  return (
    <AdminMapClient
      companyName={tenant.name ?? ''}
      points={points}
      unplaced={unplaced}
    />
  )
}
