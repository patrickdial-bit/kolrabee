import { getCurrentUser, type Project } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Fetch platform invites
  const { data: platformInvites } = await adminClient
    .from('platform_invites')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('invited_at', { ascending: false })

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
    />
  )
}
