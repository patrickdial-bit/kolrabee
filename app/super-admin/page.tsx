import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import SuperAdminDashboard from './SuperAdminDashboard'

export default async function SuperAdminPage() {
  await requireSuperAdmin()

  const adminClient = createAdminClient()

  // Fetch all tenants with owner info
  const { data: tenants } = await adminClient
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  // Get counts per tenant
  const { data: userCounts } = await adminClient
    .from('users')
    .select('tenant_id')
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  const { data: projectCounts } = await adminClient
    .from('projects')
    .select('tenant_id, status')

  // Get admin users for each tenant
  const { data: adminUsers } = await adminClient
    .from('users')
    .select('tenant_id, email, first_name, last_name')
    .eq('role', 'admin')
    .eq('status', 'active')

  // Aggregate counts
  const subCountMap: Record<string, number> = {}
  for (const u of userCounts ?? []) {
    subCountMap[u.tenant_id] = (subCountMap[u.tenant_id] || 0) + 1
  }

  const projectCountMap: Record<string, number> = {}
  for (const p of projectCounts ?? []) {
    projectCountMap[p.tenant_id] = (projectCountMap[p.tenant_id] || 0) + 1
  }

  const adminMap: Record<string, { email: string; name: string }> = {}
  for (const a of adminUsers ?? []) {
    if (!adminMap[a.tenant_id]) {
      adminMap[a.tenant_id] = { email: a.email, name: `${a.first_name} ${a.last_name}` }
    }
  }

  const tenantsWithStats = (tenants ?? []).map((t) => ({
    ...t,
    subCount: subCountMap[t.id] || 0,
    projectCount: projectCountMap[t.id] || 0,
    adminEmail: adminMap[t.id]?.email || '—',
    adminName: adminMap[t.id]?.name || '—',
  }))

  // Platform-wide stats
  const stats = {
    totalTenants: tenants?.length ?? 0,
    totalSubs: userCounts?.length ?? 0,
    totalProjects: projectCounts?.length ?? 0,
    activePlans: (tenants ?? []).filter((t) => t.plan === 'starter' || t.plan === 'pro').length,
  }

  return <SuperAdminDashboard tenants={tenantsWithStats} stats={stats} />
}
