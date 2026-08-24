import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMarketingEngine } from '@/lib/types'
import { MARKETING_ENGINE_ENABLED } from '@/lib/feature-flags'
import AppShell from '@/components/AppShell'
import MarketClient from './MarketClient'

export default async function MarketPage() {
  const { tenant } = await getCurrentUser()

  // The Marketing Engine is parked product-wide while the focus is on the
  // core dispatch job. The route stays in the tree but is not reachable.
  if (!MARKETING_ENGINE_ENABLED) notFound()

  if (!hasMarketingEngine(tenant)) {
    return (
      <AppShell variant="admin" companyName={tenant.name}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Market Intelligence</h1>
          <p className="mt-3 text-gray-600">
            Competitor intelligence is part of the Kolrabee Marketing Engine — a separate rollout enabled per company by Kolrabee.
          </p>
          <Link href="/admin/billing" className="mt-6 inline-flex items-center rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            Contact Kolrabee to enable
          </Link>
        </div>
      </AppShell>
    )
  }

  const adminClient = createAdminClient()
  const [{ data: competitors }, { data: ads }, { data: policies }, { data: runs }, { data: benchmarks }] =
    await Promise.all([
      adminClient.from('mk_competitors').select('*').eq('tenant_id', tenant.id).order('score', { ascending: false, nullsFirst: false }).limit(200),
      adminClient.from('mk_competitor_ads').select('*').eq('tenant_id', tenant.id).order('run_days', { ascending: false, nullsFirst: false }).limit(500),
      adminClient.from('mk_source_policies').select('*').order('status'),
      adminClient.from('mk_scrape_runs').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
      adminClient.from('mk_benchmarks').select('*'),
    ])

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <MarketClient
        competitors={(competitors ?? []) as any}
        ads={(ads ?? []) as any}
        policies={(policies ?? []) as any}
        runs={(runs ?? []) as any}
        benchmarks={(benchmarks ?? []) as any}
      />
    </AppShell>
  )
}
