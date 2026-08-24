import { getCurrentSub, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProjectAttachment, CrewMember, ChangeOrder, DoorKnock } from '@/lib/types'
import { hasGrowthFeatures, hasTimeTracking, isCrewLeader } from '@/lib/types'
import type { CrewMemberLite, CrewOpenEntry } from '@/components/CrewClockPanel'
import { getProjectPhotos } from '@/lib/photo-actions'
import { notFound } from 'next/navigation'
import SubProjectDetailClient from './SubProjectDetailClient'

export default async function SubProjectDetailPage({
  params,
}: {
  params: { slug: string; id: string }
}) {
  const { slug, id } = params
  const { appUser, tenant } = await getCurrentSub(slug)

  const adminClient = createAdminClient()

  // Fetch project
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    notFound()
  }

  // Fetch invitation for this sub
  const { data: invitation } = await adminClient
    .from('project_invitations')
    .select('*')
    .eq('project_id', id)
    .eq('subcontractor_id', appUser.id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  // Sub must either be invited or have accepted this project
  if (!invitation && project.accepted_by !== appUser.id) {
    notFound()
  }

  // Fetch attachments
  const { data: attachmentsData } = await adminClient
    .from('project_attachments')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  // Fetch messages (only if sub accepted this project)
  let messages: any[] = []
  if (project.accepted_by === appUser.id) {
    const { data: messagesData } = await adminClient
      .from('job_messages')
      .select('*, sender:users!job_messages_sender_id_fkey(first_name, last_name)')
      .eq('project_id', id)
      .order('created_at', { ascending: true })

    messages = (messagesData ?? []).map((m: any) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      project_id: m.project_id,
      sender_id: m.sender_id,
      body: m.body,
      created_at: m.created_at,
      sender_name: m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown',
    }))
  }

  // Crew + time tracking data (only when this sub has accepted the project).
  const isAccepted = project.accepted_by === appUser.id

  // Change orders — scope/pay history, visible once the sub has accepted the job.
  let changeOrders: ChangeOrder[] = []
  if (isAccepted) {
    const { data: coData } = await adminClient
      .from('change_orders')
      .select('*')
      .eq('project_id', id)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    changeOrders = (coData ?? []).map((c: any) => ({
      id: c.id,
      tenant_id: c.tenant_id,
      project_id: c.project_id,
      amount: Number(c.amount),
      description: c.description,
      previous_payout: Number(c.previous_payout),
      new_payout: Number(c.new_payout),
      created_by: c.created_by,
      created_at: c.created_at,
    }))
  }
  let timeClockEnabled = false
  let crewMembers: CrewMemberLite[] = []
  let crewOpenEntries: CrewOpenEntry[] = []
  let jobTotalsByActor: Record<string, number> = {}
  let crewHistory: Array<{
    id: string
    actorKey: string
    actorName: string
    clock_in: string
    clock_out: string | null
    duration_minutes: number | null
  }> = []

  if (isAccepted && hasTimeTracking(tenant)) {
    const { data: settings } = await adminClient
      .from('subcontractor_settings')
      .select('time_clock_enabled')
      .eq('subcontractor_id', appUser.id)
      .maybeSingle()
    timeClockEnabled = !!settings?.time_clock_enabled

    if (timeClockEnabled) {
      const { data: crewRows } = await adminClient
        .from('crew_members')
        .select('*')
        .eq('crew_leader_id', appUser.id)
        .eq('status', 'active')
        .order('last_name')
        .order('first_name')
      const allCrew = (crewRows ?? []) as CrewMember[]
      crewMembers = allCrew.map((m) => ({ id: m.id, first_name: m.first_name, last_name: m.last_name }))
      const memberNameById = new Map<string, string>(
        allCrew.map((m) => [m.id, `${m.first_name} ${m.last_name}`]),
      )

      // All open entries owned by this leader.
      const { data: openRows } = await adminClient
        .from('time_entries')
        .select('id, project_id, crew_member_id, clock_in, projects:project_id (customer_name, job_number)')
        .eq('subcontractor_id', appUser.id)
        .is('clock_out', null)
      for (const row of openRows ?? []) {
        const r: any = row
        const p = r.projects
        crewOpenEntries.push({
          id: r.id,
          project_id: r.project_id,
          crew_member_id: r.crew_member_id ?? null,
          clock_in: r.clock_in,
          otherProjectLabel: p?.job_number || p?.customer_name || 'another job',
        })
      }

      // Per-actor stored minutes for THIS project.
      const { data: thisProjectRows } = await adminClient
        .from('time_entries')
        .select('crew_member_id, duration_minutes')
        .eq('subcontractor_id', appUser.id)
        .eq('project_id', id)
      for (const r of thisProjectRows ?? []) {
        const actorKey = (r as any).crew_member_id ?? 'leader'
        jobTotalsByActor[actorKey] = (jobTotalsByActor[actorKey] ?? 0) + ((r as any).duration_minutes ?? 0)
      }

      // History (most recent 20) — leader plus crew, this project.
      const { data: historyRows } = await adminClient
        .from('time_entries')
        .select('id, crew_member_id, clock_in, clock_out, duration_minutes')
        .eq('subcontractor_id', appUser.id)
        .eq('project_id', id)
        .order('clock_in', { ascending: false })
        .limit(20)
      const leaderName = `${appUser.first_name} ${appUser.last_name}`
      for (const r of historyRows ?? []) {
        const actorKey = (r as any).crew_member_id ?? 'leader'
        const actorName = actorKey === 'leader'
          ? `${leaderName} (you)`
          : memberNameById.get(actorKey) ?? 'Crew member'
        crewHistory.push({
          id: (r as any).id,
          actorKey,
          actorName,
          clock_in: (r as any).clock_in,
          clock_out: (r as any).clock_out,
          duration_minutes: (r as any).duration_minutes,
        })
      }
    }
  }

  // Door-knock log for door-to-door jobs (this rep's entries, latest first).
  let doorKnocks: DoorKnock[] = []
  if (isAccepted && (project as any).project_type === 'door_to_door') {
    const { data: knockRows } = await adminClient
      .from('door_knocks')
      .select('*')
      .eq('project_id', id)
      .eq('tenant_id', tenant.id)
      .eq('subcontractor_id', appUser.id)
      .order('knocked_at', { ascending: false })
      .limit(100)
    doorKnocks = (knockRows ?? []) as DoorKnock[]
  }

  // Jobsite photos for the gallery (crews capture and view here).
  const photos = await getProjectPhotos(id)

  return (
    <SubProjectDetailClient
      slug={slug}
      tenantName={tenant.name}
      serviceArea={tenant.service_area}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      project={project as Project}
      invitation={invitation as ProjectInvitation | null}
      isAcceptedByMe={isAccepted}
      attachments={(attachmentsData ?? []) as ProjectAttachment[]}
      messages={messages}
      changeOrders={changeOrders}
      currentUserId={appUser.id}
      tenantId={tenant.id}
      photos={photos}
      hasGrowth={hasGrowthFeatures(tenant)}
      isCrewLeader={isCrewLeader(appUser)}
      timeClockEnabled={timeClockEnabled}
      leaderName={appUser.first_name}
      crewMembers={crewMembers}
      crewOpenEntries={crewOpenEntries}
      jobTotalsByActor={jobTotalsByActor}
      crewHistory={crewHistory}
      doorKnocks={doorKnocks}
    />
  )
}
