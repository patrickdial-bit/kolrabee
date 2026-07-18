import Link from 'next/link'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasGrowthFeatures } from '@/lib/types'
import type { MkCampaign, MkLead, MkLeadEvent } from '@/lib/types'
import AppShell from '@/components/AppShell'
import LeadsClient from './LeadsClient'

export type LeadSourceRow = {
  id: string
  name: string
  kind: 'website_form' | 'meta_lead_form' | 'google_lead_form' | 'webhook'
  token: string
  status: 'active' | 'paused'
}

export type AttributedProject = {
  id: string
  status: string
  revenue_amount: number | null
  payout_amount: number
  customer_name: string
  job_number: string | null
}

export default async function LeadsPage() {
  const { tenant } = await getCurrentUser()

  if (!hasGrowthFeatures(tenant)) {
    return (
      <AppShell variant="admin" companyName={tenant.name}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-3 text-gray-600">
            Lead capture and marketing attribution are available on the <strong>Growth</strong> and{' '}
            <strong>Operator</strong> plans.
          </p>
          <Link
            href="/admin/billing"
            className="mt-6 inline-flex items-center rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Upgrade to Growth
          </Link>
        </div>
      </AppShell>
    )
  }

  const adminClient = createAdminClient()

  const [{ data: leadsData }, { data: campaignsData }, { data: sourcesData }] = await Promise.all([
    adminClient
      .from('mk_leads')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(500),
    adminClient
      .from('mk_campaigns')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    adminClient
      .from('mk_lead_sources')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
  ])

  const leads = (leadsData ?? []) as MkLead[]
  const campaigns = (campaignsData ?? []) as MkCampaign[]

  let events: MkLeadEvent[] = []
  if (leads.length > 0) {
    const { data: eventsData } = await adminClient
      .from('mk_lead_events')
      .select('*')
      .in('lead_id', leads.map((l) => l.id))
      .order('created_at', { ascending: true })
      .limit(3000)
    events = (eventsData ?? []) as MkLeadEvent[]
  }

  // Attribution: the jobs these leads became, for revenue + status.
  const projectIds = leads.map((l) => l.project_id).filter(Boolean) as string[]
  let projects: AttributedProject[] = []
  if (projectIds.length > 0) {
    const { data: projectsData } = await adminClient
      .from('projects')
      .select('id, status, revenue_amount, payout_amount, customer_name, job_number')
      .in('id', projectIds)
    projects = (projectsData ?? []) as AttributedProject[]
  }

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <LeadsClient
        tenantSlug={tenant.slug}
        leads={leads}
        campaigns={campaigns}
        events={events}
        projects={projects}
        sources={(sourcesData ?? []) as LeadSourceRow[]}
      />
    </AppShell>
  )
}
