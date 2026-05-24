import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsPage } from '@/lib/ads/page-guard'
import type { AdBrandKit } from '@/lib/types'
import AdsSetupClient from './AdsSetupClient'

export default async function AdsSetupPage() {
  const { tenant, settings } = await requireAdsPage()
  const adminClient = createAdminClient()

  let { data: brandKit } = await adminClient
    .from('ad_brand_kits')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!brandKit) {
    const { data: created } = await adminClient
      .from('ad_brand_kits')
      .insert({ tenant_id: tenant.id, brand_name: tenant.name ?? '' })
      .select('*')
      .single()
    brandKit = created
  }

  return (
    <AdsSetupClient
      companyName={tenant.name ?? ''}
      complianceStatus={settings.compliance_status}
      brandKit={brandKit as AdBrandKit}
    />
  )
}
