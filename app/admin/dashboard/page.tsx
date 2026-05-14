import { getCurrentUser, type Project } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUnreadCounts } from '@/lib/message-reads'
import AdminDashboardClient from './AdminDashboardClient'

export type PlatformInvite = {
  id: string
  tenant_id: string
  email: string
  name: string | null
  status: string
  invited_at: string
  accepted_at: string | null
}

export type ProjectInviteSummary = {
  id: string
  status: 'invited' | 'accepted' | 'declined'
  subcontractor_name: string
}

export default async function AdminDashboardPage() {
  const { appUser, tenant } = await getCurrentUser()

  const adminClient = createAdminClient()
  const { data: projects } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('start_date', { ascending: true, nullsFirst: false })

  // Fetch names for all accepted_by user IDs
  const acceptedByIds = (projects ?? [])
    .map((p: any) => p.accepted_by)
    .filter((id: string | null): id is string => !!id)
  const uniqueIds = Array.from(new Set(acceptedByIds))

  let subNameMap: Record<string, string> = {}
  if (uniqueIds.length > 0) {
    const { data: subs } = await adminClient
      .from('users')
      .select('id, first_name, last_name')
      .in('id', uniqueIds)
    for (const sub of subs ?? []) {
      subNameMap[sub.id] = `${sub.first_name} ${sub.last_name}`
    }
  }

  // Get usage counts for plan limits display
  const { count: projectCount } = await adminClient
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .neq('status', 'cancelled')

  const { count: subCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  // Fetch pending subcontractor invites (accepted ones are hidden — they show up in the subcontractor list instead)
  const { data: platformInvites } = await adminClient
    .from('platform_invites')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'pending')
    .order('invited_at', { ascending: false })

  // Get unread message counts for active projects
  const activeProjectIds = (projects ?? [])
    .filter((p: any) => ['accepted', 'in_progress', 'pending_completion', 'completed'].includes(p.status))
    .map((p: any) => p.id)
  const unreadCounts = await getUnreadCounts(appUser.id, activeProjectIds)

  // Fetch project-level invitations for projects still awaiting acceptance, so
  // the dashboard can show admins who they've invited at a glance.
  const availableProjectIds = (projects ?? [])
    .filter((p: any) => p.status === 'available')
    .map((p: any) => p.id)
  const projectInvites: Record<string, ProjectInviteSummary[]> = {}
  if (availableProjectIds.length > 0) {
    const { data: rawInvites } = await adminClient
      .from('project_invitations')
      .select('id, project_id, status, subcontractor:users!project_invitations_subcontractor_id_fkey(first_name, last_name)')
      .in('project_id', availableProjectIds)
      .order('invited_at', { ascending: true })
    for (const inv of rawInvites ?? []) {
      const sub = (inv as any).subcontractor
      const list = projectInvites[inv.project_id] ?? (projectInvites[inv.project_id] = [])
      list.push({
        id: inv.id,
        status: inv.status as 'invited' | 'accepted' | 'declined',
        subcontractor_name: sub ? `${sub.first_name} ${sub.last_name}` : 'Unknown',
      })
    }
  }

  return (
    <AdminDashboardClient
      projects={(projects ?? []) as Project[]}
      subNameMap={subNameMap}
      tenantName={tenant.name ?? ''}
      tenantId={tenant.id}
      tenantSlug={tenant.slug ?? ''}
      tenantPlan={tenant.plan ?? 'free'}
      trialEndsAt={tenant.trial_ends_at ?? null}
      maxProjects={tenant.max_projects ?? 5}
      maxSubcontractors={tenant.max_subcontractors ?? 3}
      projectCount={projectCount ?? 0}
      subCount={subCount ?? 0}
      platformInvites={(platformInvites ?? []) as PlatformInvite[]}
      currentUserId={appUser.id}
      unreadCounts={unreadCounts}
      projectInvites={projectInvites}
    />
  )
}
