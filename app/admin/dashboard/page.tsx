import { getCurrentUser, type Project } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const { appUser, tenant } = await getCurrentUser()

  const adminClient = createAdminClient()
  const { data: projects } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('start_date', { ascending: true, nullsFirst: false })

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

  return (
    <AdminDashboardClient
      projects={(projects ?? []) as Project[]}
      tenantName={tenant.name}
      tenantId={tenant.id}
      tenantPlan={tenant.plan}
      trialEndsAt={tenant.trial_ends_at}
      maxProjects={tenant.max_projects}
      maxSubcontractors={tenant.max_subcontractors}
      projectCount={projectCount ?? 0}
      subCount={subCount ?? 0}
    />
  )
}
