import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsPage } from '@/lib/ads/page-guard'
import { signAsset, storagePaths } from '@/lib/ads/storage'
import type { AdConcept, AdGenerationRun } from '@/lib/types'
import AdsReviewClient from './AdsReviewClient'

export default async function AdsRunReviewPage({ params }: { params: { id: string } }) {
  const { tenant, settings } = await requireAdsPage()
  const adminClient = createAdminClient()

  const { data: run } = await adminClient
    .from('ad_generation_runs')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!run) redirect('/admin/ads')

  const { data: concepts } = await adminClient
    .from('ad_concepts')
    .select('*')
    .eq('run_id', params.id)
    .eq('tenant_id', tenant.id)
    .order('variant_index', { ascending: true })
    .order('created_at', { ascending: true })

  // Fresh signed URLs for display (stored ones expire after 7 days).
  const signed = await Promise.all(
    (concepts ?? []).map(async (c: AdConcept) => {
      if (!c.image_url) return c
      try {
        return { ...c, image_url: await signAsset(storagePaths.conceptImage(tenant.id, params.id, c.id)) }
      } catch {
        return c
      }
    })
  )

  return (
    <AdsReviewClient
      companyName={tenant.name ?? ''}
      complianceStatus={settings.compliance_status}
      run={run as AdGenerationRun}
      initialConcepts={signed as AdConcept[]}
    />
  )
}
