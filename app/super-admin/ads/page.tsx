import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import AdsAddonsClient from './AdsAddonsClient'

export default async function SuperAdminAdsPage() {
  await requireSuperAdmin()
  const adminClient = createAdminClient()

  const { data: tenants } = await adminClient
    .from('tenants')
    .select('id, name, slug')
    .order('name', { ascending: true })

  const { data: settings } = await adminClient.from('ad_addon_settings').select('*')
  const byTenant = new Map((settings ?? []).map((s: any) => [s.tenant_id, s]))

  const rows = (tenants ?? []).map((t: any) => ({
    tenant_id: t.id,
    tenant_name: t.name,
    tenant_slug: t.slug,
    settings: byTenant.get(t.id) ?? null,
  }))

  return <AdsAddonsClient rows={rows} />
}
