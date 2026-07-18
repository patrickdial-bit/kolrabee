import { getCurrentSub, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasGrowthFeatures, hasTimeTracking, isCrewLeader } from '@/lib/types'
import { getUnreadCounts } from '@/lib/message-reads'
import type { CrewMemberLite, CrewOpenEntry } from '@/components/CrewClockPanel'
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
  let staleEntries: Array<{ id: string; clock_in: string; projectLabel: string; actorName: string; isCrew: boolean }> = []
  let crewMembers: CrewMemberLite[] = []
  let crewOpenEntries: CrewOpenEntry[] = []
  let jobTotals: Record<string, Record<string, number>> = {}

  if (timeTrackingAvailable) {
    const { data: settings } = await adminClient
      .from('subcontractor_settings')
      .select('time_clock_enabled')
      .eq('subcontractor_id', appUser.id)
      .maybeSingle()
    timeClockEnabled = !!settings?.time_clock_enabled

    if (timeClockEnabled) {
      // Active crew roster for this leader.
      const { data: crewRows } = await adminClient
        .from('crew_members')
        .select('id, first_name, last_name')
        .eq('crew_leader_id', appUser.id)
        .eq('status', 'active')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
      crewMembers = (crewRows ?? []) as CrewMemberLite[]

      // All open entries owned by this leader (covers the leader and all crew members
      // in a single query because subcontractor_id is the leader for every row).
      const { data: openRows } = await adminClient
        .from('time_entries')
        .select('id, project_id, crew_member_id, clock_in, projects:project_id (customer_name, job_number)')
        .eq('subcontractor_id', appUser.id)
        .is('clock_out', null)

      for (const row of openRows ?? []) {
        const r: any = row
        const p = r.projects
        const otherProjectLabel = p?.job_number || p?.customer_name || 'another job'
        crewOpenEntries.push({
          id: r.id,
          project_id: r.project_id,
          crew_member_id: r.crew_member_id ?? null,
          clock_in: r.clock_in,
          otherProjectLabel,
        })
        if (r.crew_member_id == null) {
          openEntry = { id: r.id, project_id: r.project_id, clock_in: r.clock_in }
        }
        // Stale detection covers the leader AND every crew member — a crew
        // entry left open banks phantom hours just the same.
        const ageMs = Date.now() - new Date(r.clock_in).getTime()
        if (ageMs > 12 * 60 * 60 * 1000) {
          const member = r.crew_member_id
            ? crewMembers.find((m) => m.id === r.crew_member_id)
            : null
          staleEntries.push({
            id: r.id,
            clock_in: r.clock_in,
            projectLabel: otherProjectLabel,
            actorName: r.crew_member_id == null
              ? 'You'
              : member
                ? `${member.first_name} ${member.last_name}`
                : 'Crew member',
            isCrew: r.crew_member_id != null,
          })
        }
      }

      // Per-project minute aggregates for visible jobs.
      const projectIds = myJobs.map((j) => j.id)
      if (projectIds.length > 0) {
        const { data: rows } = await adminClient
          .from('time_entries')
          .select('project_id, crew_member_id, clock_in, clock_out, duration_minutes')
          .eq('subcontractor_id', appUser.id)
          .in('project_id', projectIds)

        for (const r of rows ?? []) {
          const actorKey = r.crew_member_id ?? 'leader'
          // Aggregate only stored minutes; the panel adds running-clock minutes client-side.
          const minutes = r.duration_minutes ?? 0
          if (!jobTotals[r.project_id]) jobTotals[r.project_id] = {}
          jobTotals[r.project_id][actorKey] = (jobTotals[r.project_id][actorKey] ?? 0) + minutes
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
      staleEntries={staleEntries}
      tenantTimezone={tenant.timezone ?? 'America/New_York'}
      isCrewLeader={isCrewLeader(appUser)}
      leaderName={appUser.first_name}
      crewMembers={crewMembers}
      crewOpenEntries={crewOpenEntries}
      jobTotals={jobTotals}
    />
  )
}
