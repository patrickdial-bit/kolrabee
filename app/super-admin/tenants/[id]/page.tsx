import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import TenantDetailClient from './TenantDetailClient'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  await requireSuperAdmin()

  const adminClient = createAdminClient()

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!tenant) {
    return <div className="p-8 text-center text-gray-500">Tenant not found.</div>
  }

  // Get all users for this tenant
  const { data: users } = await adminClient
    .from('users')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('role', { ascending: true })
    .order('first_name', { ascending: true })

  // Get all projects
  const { data: projects } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  // Get platform invites
  const { data: invites } = await adminClient
    .from('platform_invites')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('invited_at', { ascending: false })

  return (
    <TenantDetailClient
      tenant={tenant}
      users={users ?? []}
      projects={projects ?? []}
      invites={invites ?? []}
    />
  )
}
