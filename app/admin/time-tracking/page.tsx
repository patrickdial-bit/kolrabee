import Link from 'next/link'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasTimeTracking } from '@/lib/types'
import AppShell from '@/components/AppShell'
import TimeTrackingClient from './TimeTrackingClient'

export default async function TimeTrackingPage() {
  const { appUser, tenant } = await getCurrentUser()

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

  const adminClient = createAdminClient()

  const [{ data: entries }, { data: subs }, { data: projects }] = await Promise.all([
    adminClient
      .from('time_entries')
      // Embed the project and crew member on each entry so the job label never
      // depends on a separate (row-capped) projects fetch.
      .select('id, subcontractor_id, crew_member_id, project_id, clock_in, clock_out, duration_minutes, notes, edited_by_admin_id, edited_at, project:project_id (customer_name, job_number), crew_member:crew_member_id (first_name, last_name)')
      .eq('tenant_id', tenant.id)
      .order('clock_in', { ascending: false })
      .limit(2000),
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

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <TimeTrackingClient
        tenantTimezone={tenant.timezone ?? 'America/New_York'}
        entries={(entries ?? []) as any}
        subs={(subs ?? []) as any}
        projects={(projects ?? []) as any}
      />
    </AppShell>
  )
}
