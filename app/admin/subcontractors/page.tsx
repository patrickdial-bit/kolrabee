import { getCurrentUser } from '@/lib/helpers'
import type { AppUser, SubcontractorWithStats } from '@/lib/types'
import { createAdminClient } from '@/lib/supabase/admin'
import SubcontractorListClient from './SubcontractorListClient'

export default async function SubcontractorsPage() {
  const { appUser, tenant } = await getCurrentUser()

  const adminClient = createAdminClient()

  // Fetch all subcontractors for this tenant
  const { data: subs } = await adminClient
    .from('users')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .order('first_name', { ascending: true })

  const subcontractors = (subs ?? []) as AppUser[]

  // Get start of current year in ISO format
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()

  // Fetch YTD paid projects (status='paid', paid_at >= start of year)
  const { data: paidProjects } = await adminClient
    .from('projects')
    .select('accepted_by, payout_amount')
    .eq('tenant_id', tenant.id)
    .eq('status', 'paid')
    .gte('paid_at', yearStart)

  // Fetch active jobs (status in 'accepted','pending_completion','completed')
  const { data: activeProjects } = await adminClient
    .from('projects')
    .select('accepted_by')
    .eq('tenant_id', tenant.id)
    .in('status', ['accepted', 'pending_completion', 'completed'])

  // Build lookup maps
  const ytdPaidMap = new Map<string, number>()
  for (const p of paidProjects ?? []) {
    if (p.accepted_by) {
      ytdPaidMap.set(p.accepted_by, (ytdPaidMap.get(p.accepted_by) ?? 0) + (p.payout_amount ?? 0))
    }
  }

  const activeJobsMap = new Map<string, number>()
  for (const p of activeProjects ?? []) {
    if (p.accepted_by) {
      activeJobsMap.set(p.accepted_by, (activeJobsMap.get(p.accepted_by) ?? 0) + 1)
    }
  }

  // Fetch all ratings for subs in this tenant
  const { data: ratingsData } = await adminClient
    .from('sub_ratings')
    .select('subcontractor_id, rating')
    .eq('tenant_id', tenant.id)

  const ratingMap = new Map<string, { sum: number; count: number }>()
  for (const r of ratingsData ?? []) {
    const existing = ratingMap.get(r.subcontractor_id) ?? { sum: 0, count: 0 }
    existing.sum += r.rating
    existing.count += 1
    ratingMap.set(r.subcontractor_id, existing)
  }

  // Fetch total jobs per sub
  const { data: allProjects } = await adminClient
    .from('projects')
    .select('accepted_by')
    .eq('tenant_id', tenant.id)
    .not('accepted_by', 'is', null)

  const totalJobsMap = new Map<string, number>()
  for (const p of allProjects ?? []) {
    if (p.accepted_by) {
      totalJobsMap.set(p.accepted_by, (totalJobsMap.get(p.accepted_by) ?? 0) + 1)
    }
  }

  // Merge stats into subcontractors
  const subsWithStats: SubcontractorWithStats[] = subcontractors.map((sub) => {
    const ratingInfo = ratingMap.get(sub.id)
    return {
      ...sub,
      ytdPaid: ytdPaidMap.get(sub.id) ?? 0,
      activeJobs: activeJobsMap.get(sub.id) ?? 0,
      avgRating: ratingInfo ? ratingInfo.sum / ratingInfo.count : null,
      totalJobs: totalJobsMap.get(sub.id) ?? 0,
    }
  })

  return (
    <SubcontractorListClient
      subcontractors={subsWithStats}
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
    />
  )
}
