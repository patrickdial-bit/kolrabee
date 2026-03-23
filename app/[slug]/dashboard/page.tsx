import { getCurrentSub, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
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
      .eq('accepted_by', appUser.id)
      .eq('status', 'paid')
      .gte('paid_at', `${new Date().getFullYear()}-01-01`)

    ytdEarnings = (paidProjects ?? []).reduce((sum, p) => sum + (p.payout_amount || 0), 0)
  }

  // Available projects: projects this sub is invited to (invitation status='invited', project status='available', not expired)
  const { data: invitations } = await adminClient
    .from('project_invitations')
    .select('project_id, expires_at')
    .eq('subcontractor_id', appUser.id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'invited')

  const now = new Date().toISOString()
  const invitedProjectIds = (invitations ?? [])
    .filter((i) => !i.expires_at || i.expires_at > now)
    .map((i) => i.project_id)

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

  // My jobs: projects accepted by this sub with status in ('accepted', 'completed')
  const { data: myJobsData } = await adminClient
    .from('projects')
    .select('*')
    .eq('accepted_by', appUser.id)
    .in('status', ['accepted', 'completed'])
    .order('start_date', { ascending: true, nullsFirst: false })

  const myJobs = (myJobsData ?? []) as Project[]

  // Paid projects
  const { data: paidData } = await adminClient
    .from('projects')
    .select('*')
    .eq('accepted_by', appUser.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  const paidProjects = (paidData ?? []) as Project[]

  // All-time earnings
  const allTimeEarnings = paidProjects.reduce((sum, p) => sum + (p.payout_amount || 0), 0)

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
    />
  )
}
