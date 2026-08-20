import Link from 'next/link'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasTimeTracking } from '@/lib/types'
import { resolveRange } from '@/lib/time-tracking'
import AppShell from '@/components/AppShell'
import TimeTrackingClient from './TimeTrackingClient'

// Ceiling on entries pulled for one report. The range is pushed down to the
// query, so this only bites on very wide ranges — the client then tells the
// admin to narrow the time frame rather than showing a silently short total.
const MAX_ENTRIES = 5000

interface PageProps {
  searchParams: {
    range?: string
    from?: string
    to?: string
    sub?: string
    project?: string
    q?: string
    group?: string
  }
}

export default async function TimeTrackingPage({ searchParams }: PageProps) {
  const { tenant } = await getCurrentUser()

  if (!hasTimeTracking(tenant)) {
    return (
      <AppShell variant="admin" companyName={tenant.name}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="mt-3 text-gray-600">
            Time tracking is available on the <strong>Growth</strong> and <strong>Operator</strong> plans.
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

  // Ranges are resolved in company time so "this month" means the same thing
  // for every admin, wherever they open the report from.
  const tenantTimezone = tenant.timezone ?? 'America/New_York'
  const range = resolveRange(searchParams.range, {
    from: searchParams.from,
    to: searchParams.to,
    timezone: tenantTimezone,
  })

  const adminClient = createAdminClient()

  let entriesQuery = adminClient
    .from('time_entries')
    // Embed the project and crew member on each entry so the job label never
    // depends on a separate (row-capped) projects fetch.
    .select(
      'id, subcontractor_id, crew_member_id, project_id, clock_in, clock_out, duration_minutes, notes, edited_by_admin_id, edited_at, project:project_id (customer_name, job_number, address, status), crew_member:crew_member_id (first_name, last_name)'
    )
    .eq('tenant_id', tenant.id)
    .order('clock_in', { ascending: false })
    .limit(MAX_ENTRIES + 1)

  if (range.startUtc) entriesQuery = entriesQuery.gte('clock_in', range.startUtc)
  if (range.endUtc) entriesQuery = entriesQuery.lt('clock_in', range.endUtc)

  const [{ data: entryRows }, { data: subs }, { data: projects }] = await Promise.all([
    entriesQuery,
    adminClient
      .from('users')
      .select('id, first_name, last_name, company_name')
      .eq('tenant_id', tenant.id)
      .eq('role', 'subcontractor')
      .order('company_name', { ascending: true, nullsFirst: false })
      .order('first_name'),
    adminClient
      .from('projects')
      .select('id, customer_name, job_number')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const allEntries = entryRows ?? []
  const truncated = allEntries.length > MAX_ENTRIES
  const entries = truncated ? allEntries.slice(0, MAX_ENTRIES) : allEntries

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <TimeTrackingClient
        tenantTimezone={tenantTimezone}
        range={range}
        truncated={truncated}
        maxEntries={MAX_ENTRIES}
        entries={entries as any}
        subs={(subs ?? []) as any}
        projects={(projects ?? []) as any}
        initialSubFilter={searchParams.sub ?? 'all'}
        initialProjectFilter={searchParams.project ?? 'all'}
        initialSearch={searchParams.q ?? ''}
        initialGroupBy={searchParams.group ?? 'job'}
      />
    </AppShell>
  )
}
