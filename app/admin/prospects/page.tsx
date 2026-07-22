import Link from 'next/link'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasGrowthFeatures } from '@/lib/types'
import AppShell from '@/components/AppShell'
import ProspectsClient from './ProspectsClient'

export type ProspectRow = {
  id: string
  parcel_id: string | null
  address: string
  city: string | null
  state: string | null
  zip: string | null
  owner_name: string | null
  owner_occupied: boolean | null
  year_built: number | null
  assessed_value: number | null
  lot_acres: number | null
  last_sale_date: string | null
  score: number | null
  score_reasons: Array<{ label: string; points: number }> | null
  suppressed: boolean
  status: string
  lead_id: string | null
  created_at: string
}

export default async function ProspectsPage() {
  const { tenant } = await getCurrentUser()

  if (!hasGrowthFeatures(tenant)) {
    return (
      <AppShell variant="admin" companyName={tenant.name}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Prospector</h1>
          <p className="mt-3 text-gray-600">
            Homeowner prospecting is available on the <strong>Growth</strong> and <strong>Operator</strong> plans.
          </p>
          <Link href="/admin/billing" className="mt-6 inline-flex items-center rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            Upgrade to Growth
          </Link>
        </div>
      </AppShell>
    )
  }

  const adminClient = createAdminClient()
  const { data: prospects } = await adminClient
    .from('mk_prospects')
    .select('id, parcel_id, address, city, state, zip, owner_name, owner_occupied, year_built, assessed_value, lot_acres, last_sale_date, score, score_reasons, suppressed, status, lead_id, created_at')
    .eq('tenant_id', tenant.id)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(2000)

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <ProspectsClient prospects={(prospects ?? []) as ProspectRow[]} />
    </AppShell>
  )
}
