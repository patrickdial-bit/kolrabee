import Link from 'next/link'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasTimeTracking } from '@/lib/types'
import { resolveRange } from '@/lib/time-tracking'
import AdminNav from '@/components/AdminNav'
import TimeTrackingClient from './TimeTrackingClient'

// Hard ceiling on entries pulled for one report. Anything larger is truncated
// and the client tells the admin to narrow the range.
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
      <div className="min-h-screen bg-gray-50">
        <AdminNav companyName={tenant.name} />
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
      </div>
    )
  }

  const timezone = tenant.timezone ?? 'America/New_York'
  const range = resolveRange(searchParams.range, {
    from: searchParams.from,
    to: searchParams.to,
    timezone,
  })

  const adminClient = createAdminClient()

  let entriesQuery = adminClient
    .from('time_entries')
    .select(
      'id, subcontractor_id, crew_member_id, project_id, clock_in, clock_out, duration_minutes, notes, edited_by_admin_id, edited_at'
    )
    .eq('tenant_id', tenant.id)
    .order('clock_in', { ascending: false })
    .limit(MAX_ENTRIES + 1)

  if (range.startUtc) entriesQuery = entriesQuery.gte('clock_in', range.startUtc)
  if (range.endUtc) entriesQuery = entriesQuery.lt('clock_in', range.endUtc)

  const [{ data: entryRows }, { data: subs }, { data: projects }, { data: crew }] = await Promise.all([
    entriesQuery,
    adminClient
      .from('users')
      .select('id, first_name, last_name, status')
      .eq('tenant_id', tenant.id)
      .eq('role', 'subcontractor')
      .order('first_name'),
    adminClient
      .from('projects')
      .select('id, customer_name, job_number, address, status')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    adminClient
      .from('crew_members')
      .select('id, first_name, last_name, crew_leader_id')
      .eq('tenant_id', tenant.id)
      .order('first_name'),
  ])

  const allEntries = entryRows ?? []
  const truncated = allEntries.length > MAX_ENTRIES
  const entries = truncated ? allEntries.slice(0, MAX_ENTRIES) : allEntries

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenant.name} />
      <TimeTrackingClient
        timezone={timezone}
        range={range}
        truncated={truncated}
        maxEntries={MAX_ENTRIES}
        entries={entries as any}
        subs={(subs ?? []) as any}
        projects={(projects ?? []) as any}
        crew={(crew ?? []) as any}
        initialSubFilter={searchParams.sub ?? 'all'}
        initialProjectFilter={searchParams.project ?? 'all'}
        initialSearch={searchParams.q ?? ''}
        initialGroupBy={searchParams.group ?? 'job'}
      />
    </div>
  )
}
