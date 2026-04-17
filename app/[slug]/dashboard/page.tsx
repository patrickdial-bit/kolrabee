import { getCurrentSub, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasGrowthFeatures, hasTimeTracking } from '@/lib/types'
import { getUnreadCounts } from '@/lib/message-reads'
import SubDashboardClient from './SubDashboardClient'

export default async function SubDashboardPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { appUser, tenant } = await getCurrentSub(slug)

  const adminClient = createAdminClient()

  // YTD earnings
  const { data: earningsData } = await adminClient
    .rpc('get_ytd_earnings', { sub_id: appUser.id })

  // Fallback: if RPC doesn't exist, query directly
  let ytdEarnings = 0
  if (earningsData !== null && earningsData !== undefined) {
    ytdEarnings = Number(earningsData) || 0
  } else {
    const { data: paidProjects } = await adminClient
      .from('projects')
      .select('payout_amount')
      .eq('tenant_id', tenant.id)
      .eq('accepted_by', appUser.id)
      .eq('status', 'paid')
      .gte('paid_at', `${new Date().getFullYear()}-01-01`)

    ytdEarnings = (paidProjects ?? []).reduce((sum, p) => sum + (p.payout_amount || 0), 0)
  }

  // Available projects: projects this sub is invited to (invitation status='invited', project status='available')
  const { data: invitations } = await adminClient
    .from('project_invitations')
    .select('project_id')
    .eq('subcontractor_id', appUser.id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'invited')

  const invitedProjectIds = (invitations ?? []).map((i) => i.project_id)

  let availableProjects: Project[] = []
  if (invitedProjectIds.length > 0) {
    const { data } = await adminClient
      .from('projects')
      .select('*')
      .in('id', invitedProjectIds)
      .eq('status', 'available')
      .order('start_date', { ascending: true, nullsFirst: false })

    availableProjects = (data ?? []) as Project[]
  }

  // My jobs: projects accepted by this sub with active statuses
  const { data: myJobsData } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .in('status', ['accepted', 'in_progress', 'pending_completion', 'completed'])
    .order('start_date', { ascending: true, nullsFirst: false })

  const myJobs = (myJobsData ?? []) as Project[]

  // Paid projects
  const { data: paidData } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  const paidProjects = (paidData ?? []) as Project[]

  // All-time earnings
  const allTimeEarnings = paidProjects.reduce((sum, p) => sum + (p.payout_amount || 0), 0)

  // Sub rating stats (Growth/Operator only)
  let avgRating = 0
  let totalRatings = 0
  if (hasGrowthFeatures(tenant)) {
    const { data: ratings } = await adminClient
      .from('sub_ratings')
      .select('rating')
      .eq('subcontractor_id', appUser.id)

    const ratingsList = ratings ?? []
    totalRatings = ratingsList.length
    avgRating = totalRatings > 0
      ? ratingsList.reduce((sum: number, r: any) => sum + r.rating, 0) / totalRatings
      : 0
  }

  // Get unread message counts
  const myJobIds = myJobs.map(j => j.id)
  const unreadCounts = await getUnreadCounts(appUser.id, myJobIds)

  // Time tracking state
  const timeTrackingAvailable = hasTimeTracking(tenant)
  let timeClockEnabled = false
  let openEntry: { id: string; project_id: string; clock_in: string } | null = null
  let staleOpenEntry: { id: string; project_id: string; clock_in: string; projectLabel: string } | null = null
  if (timeTrackingAvailable) {
    const { data: settings } = await adminClient
      .from('subcontractor_settings')
      .select('time_clock_enabled')
      .eq('subcontractor_id', appUser.id)
      .maybeSingle()
    timeClockEnabled = !!settings?.time_clock_enabled

    if (timeClockEnabled) {
      const { data: open } = await adminClient
        .from('time_entries')
        .select('id, project_id, clock_in, projects:project_id (customer_name, job_number)')
        .eq('subcontractor_id', appUser.id)
        .is('clock_out', null)
        .maybeSingle()
      if (open) {
        openEntry = { id: open.id, project_id: open.project_id, clock_in: open.clock_in }
        const ageMs = Date.now() - new Date(open.clock_in).getTime()
        if (ageMs > 12 * 60 * 60 * 1000) {
          const p = (open as any).projects
          staleOpenEntry = {
            ...openEntry,
            projectLabel: p?.job_number || p?.customer_name || 'a job',
          }
        }
      }
    }
  }

  return (
    <SubDashboardClient
      slug={slug}
      tenantName={tenant.name}
      ytdEarnings={ytdEarnings}
      allTimeEarnings={allTimeEarnings}
      availableProjects={availableProjects}
      myJobs={myJobs}
      paidProjects={paidProjects}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      hasGrowth={hasGrowthFeatures(tenant)}
      currentUserId={appUser.id}
      tenantPlan={tenant.plan ?? 'free'}
      avgRating={avgRating}
      totalRatings={totalRatings}
      unreadCounts={unreadCounts}
      timeClockEnabled={timeTrackingAvailable && timeClockEnabled}
      openTimeEntry={openEntry}
      staleTimeEntry={staleOpenEntry}
      tenantTimezone={tenant.timezone ?? 'America/New_York'}
    />
  )
}
