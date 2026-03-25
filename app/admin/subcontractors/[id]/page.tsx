import { notFound } from 'next/navigation'
import { getCurrentUser, type AppUser, type Project } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ReliabilityStats } from '@/lib/types'
import SubDetailClient from './SubDetailClient'

export default async function SubDetailPage({ params }: { params: { id: string } }) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  // Fetch the subcontractor
  const { data: sub, error } = await adminClient
    .from('users')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (error || !sub) {
    notFound()
  }

  // Fetch their project history (projects they accepted)
  const { data: projects } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', params.id)
    .order('created_at', { ascending: false })

  // Fetch their invitation history for reliability stats
  const { data: invitations } = await adminClient
    .from('project_invitations')
    .select('status')
    .eq('subcontractor_id', params.id)
    .eq('tenant_id', tenant.id)

  // Calculate YTD earnings
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const allProjects = (projects ?? []) as Project[]
  const ytdEarnings = allProjects
    .filter((p) => p.status === 'paid' && p.paid_at && p.paid_at >= yearStart)
    .reduce((sum, p) => sum + (p.payout_amount ?? 0), 0)

  // Calculate reliability stats
  const invList = invitations ?? []
  const totalInvited = invList.length
  const totalAccepted = invList.filter((i: any) => i.status === 'accepted').length
  const totalDeclined = invList.filter((i: any) => i.status === 'declined').length
  const totalCompleted = allProjects.filter((p) => p.status === 'completed' || p.status === 'paid').length
  const totalPaid = allProjects.filter((p) => p.status === 'paid').length
  // Cancelled = projects that were accepted by this sub but are now back to 'available' (not in their accepted_by anymore)
  // We approximate: invitations marked 'accepted' minus projects currently assigned = cancellations
  const totalCancelled = allProjects.filter((p) => p.status === 'cancelled' || p.status === 'available').length
  const acceptRate = totalInvited > 0 ? Math.round((totalAccepted / totalInvited) * 100) : 0
  const totalStarted = totalAccepted + totalCancelled
  const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0

  const reliabilityStats: ReliabilityStats = {
    totalInvited,
    totalAccepted,
    totalDeclined,
    totalCompleted,
    totalPaid,
    totalCancelled,
    acceptRate,
    completionRate,
  }

  // Fetch rating stats
  const { data: ratings } = await adminClient
    .from('sub_ratings')
    .select('rating')
    .eq('tenant_id', tenant.id)
    .eq('subcontractor_id', params.id)

  const ratingsList = ratings ?? []
  const avgRating = ratingsList.length > 0
    ? ratingsList.reduce((sum: number, r: any) => sum + r.rating, 0) / ratingsList.length
    : null
  const totalJobs = (projects ?? []).length

  return (
    <SubDetailClient
      sub={sub as AppUser}
      projects={allProjects}
      ytdEarnings={ytdEarnings}
      reliabilityStats={reliabilityStats}
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      avgRating={avgRating}
      totalJobs={totalJobs}
      totalRatings={ratingsList.length}
    />
  )
}
