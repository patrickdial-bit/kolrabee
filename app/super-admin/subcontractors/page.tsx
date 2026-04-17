import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import SubcontractorsClient from './SubcontractorsClient'

export default async function SuperAdminSubcontractorsPage() {
  await requireSuperAdmin()

  const adminClient = createAdminClient()

  const { data: subs } = await adminClient
    .from('users')
    .select('id, first_name, last_name, email, company_name, status, tenant_id, w9_file_url, coi_file_url, insurance_expiration, created_at')
    .eq('role', 'subcontractor')
    .order('created_at', { ascending: false })

  const { data: tenants } = await adminClient
    .from('tenants')
    .select('id, name, slug')

  const tenantMap = new Map<string, { name: string; slug: string }>()
  for (const t of tenants ?? []) {
    tenantMap.set(t.id, { name: t.name, slug: t.slug })
  }

  const rows = (subs ?? []).map((s) => ({
    ...s,
    tenantName: tenantMap.get(s.tenant_id)?.name ?? '—',
    tenantSlug: tenantMap.get(s.tenant_id)?.slug ?? '',
  }))

  return <SubcontractorsClient subs={rows} />
}
