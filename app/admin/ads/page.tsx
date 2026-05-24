import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsPage } from '@/lib/ads/page-guard'
import type { AdBrandKit, AdGenerationRun } from '@/lib/types'
import AdsDashboardClient from './AdsDashboardClient'

export default async function AdsDashboardPage() {
  const { tenant, settings } = await requireAdsPage()
  const adminClient = createAdminClient()

  const { data: brandKit } = await adminClient
    .from('ad_brand_kits')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const { data: runs } = await adminClient
    .from('ad_generation_runs')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  return (
    <AdsDashboardClient
      companyName={tenant.name ?? ''}
      complianceStatus={settings.compliance_status}
      monthlyRunLimit={settings.monthly_run_limit}
      runsThisMonth={settings.runs_this_month}
      brandKit={(brandKit as AdBrandKit) ?? null}
      runs={(runs ?? []) as AdGenerationRun[]}
    />
  )
}
