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

  return (
    <AdminDashboardClient
      projects={(projects ?? []) as Project[]}
      tenantName={tenant.name}
    />
  )
}
